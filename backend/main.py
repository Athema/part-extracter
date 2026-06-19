import os
import sys

# Make FFmpeg DLLs findable for torchcodec before any audio library is imported
_ffmpeg_bin = r"C:\ffmpeg\bin"
if os.path.isdir(_ffmpeg_bin) and _ffmpeg_bin not in os.environ.get("PATH", ""):
    os.environ["PATH"] = _ffmpeg_bin + os.pathsep + os.environ["PATH"]

import uuid
import asyncio
import logging
import traceback
from pathlib import Path
from typing import Dict

import aiofiles
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Part Extracter")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = Path("temp")
TEMP_DIR.mkdir(exist_ok=True)

# job structure:
# {
#   "status": "queued|separating|transcribing|scoring|complete|error",
#   "progress": 0-100,
#   "message": str,
#   "regions": [
#     {
#       "label": str,
#       "stem": str,
#       "start_time": float,
#       "end_time": float,
#       "snippets": [
#         {"path": str, "label": "Bars 1–4", "start_bar": 1, "end_bar": 4},
#         ...
#       ]
#     },
#     ...
#   ]
# }
jobs: Dict[str, dict] = {}


class Region(BaseModel):
    label: str
    stem: str
    start_time: float
    end_time: float


class ProcessRequest(BaseModel):
    file_id: str
    regions: list[Region]


@app.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    try:
        logger.info(f"Upload received: {file.filename} ({file.content_type})")
        file_id = str(uuid.uuid4())
        suffix = Path(file.filename).suffix or ".mp3"
        file_path = TEMP_DIR / file_id / f"original{suffix}"
        file_path.parent.mkdir(parents=True, exist_ok=True)

        async with aiofiles.open(file_path, "wb") as f:
            content = await file.read()
            await f.write(content)

        logger.info(f"Saved {len(content)} bytes to {file_path}")
        return {"file_id": file_id, "filename": file.filename}
    except Exception as e:
        logger.error(f"Upload failed: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/audio/{file_id}")
async def get_audio(file_id: str):
    file_dir = TEMP_DIR / file_id
    if not file_dir.exists():
        raise HTTPException(status_code=404, detail="File not found")
    candidates = list(file_dir.glob("original.*"))
    if not candidates:
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(candidates[0])


@app.post("/process")
async def process_audio(request: ProcessRequest, background_tasks: BackgroundTasks):
    file_dir = TEMP_DIR / request.file_id
    if not file_dir.exists():
        raise HTTPException(status_code=404, detail="File not found")

    audio_files = list(file_dir.glob("original.*"))
    if not audio_files:
        raise HTTPException(status_code=404, detail="Audio file not found")

    job_id = str(uuid.uuid4())
    # Pre-populate regions list (snippets will be filled during processing)
    jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "message": "Queued for processing",
        "regions": [
            {
                "label": r.label,
                "stem": r.stem,
                "start_time": r.start_time,
                "end_time": r.end_time,
                "midi_path": None,
            }
            for r in request.regions
        ],
    }

    background_tasks.add_task(run_job, job_id, audio_files[0], request.regions)
    return {"job_id": job_id}


@app.get("/status/{job_id}")
async def get_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]

    public_regions = [
        {
            "label": region["label"],
            "stem": region["stem"],
            "start_time": region["start_time"],
            "end_time": region["end_time"],
            "done": bool(region.get("midi_path")),
        }
        for region in job["regions"]
    ]

    return {
        "status": job["status"],
        "progress": job["progress"],
        "message": job["message"],
        "regions": public_regions,
    }


@app.get("/midi/{job_id}/{region_index}")
async def get_midi(job_id: str, region_index: int):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    regions = jobs[job_id].get("regions", [])
    if region_index >= len(regions):
        raise HTTPException(status_code=404, detail="Region not found")

    region = regions[region_index]
    midi_path = region.get("midi_path")
    if not midi_path or not Path(midi_path).exists():
        raise HTTPException(status_code=404, detail="MIDI not ready")

    safe_name = region["label"].replace(" ", "_") + ".mid"
    return FileResponse(Path(midi_path), media_type="audio/midi", filename=safe_name)


async def run_job(job_id: str, audio_path: Path, regions: list[Region]):
    from processing.separator import separate_stems
    from processing.transcriber import transcribe_stem

    def update(status: str, message: str, progress: int):
        jobs[job_id].update(status=status, message=message, progress=progress)

    try:
        num_regions = max(len(regions), 1)
        step = 80 // num_regions

        for i, region in enumerate(regions):
            base_progress = 10 + i * step

            update("separating", f"Separating '{region.label}' with Demucs…", base_progress)
            stem_paths = await asyncio.to_thread(
                separate_stems,
                audio_path,
                [region.stem],
                region.start_time,
                region.end_time,
                region.label,
            )

            if region.stem not in stem_paths:
                logger.warning(f"Stem '{region.stem}' not found for region '{region.label}'")
                continue

            update("transcribing", f"Transcribing '{region.label}' to MIDI…", base_progress + step // 2)
            midi_path = await asyncio.to_thread(transcribe_stem, stem_paths[region.stem])

            jobs[job_id]["regions"][i]["midi_path"] = str(midi_path)
            logger.info(f"Region '{region.label}': MIDI at {midi_path}")

        done = sum(1 for r in jobs[job_id]["regions"] if r.get("midi_path"))
        jobs[job_id].update(
            status="complete",
            progress=100,
            message=f"Done! {done} of {len(regions)} region(s) transcribed.",
        )

    except Exception as exc:
        logger.error(f"Job {job_id} failed: {traceback.format_exc()}")
        jobs[job_id].update(status="error", message=f"Error: {exc}", progress=0)
