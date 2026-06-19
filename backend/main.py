import uuid
import asyncio
from pathlib import Path
from typing import Dict

import aiofiles
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

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
#   "stems": [str],
#   "scores": {
#     "piano": [
#       {"path": str, "label": "Bars 4–12", "start_bar": 4, "end_bar": 12},
#       ...
#     ]
#   }
# }
jobs: Dict[str, dict] = {}


class ProcessRequest(BaseModel):
    file_id: str
    stems: list[str]


@app.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    suffix = Path(file.filename).suffix or ".mp3"
    file_path = TEMP_DIR / file_id / f"original{suffix}"
    file_path.parent.mkdir(parents=True, exist_ok=True)

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    return {"file_id": file_id, "filename": file.filename}


@app.post("/process")
async def process_audio(request: ProcessRequest, background_tasks: BackgroundTasks):
    file_dir = TEMP_DIR / request.file_id
    if not file_dir.exists():
        raise HTTPException(status_code=404, detail="File not found")

    audio_files = list(file_dir.glob("original.*"))
    if not audio_files:
        raise HTTPException(status_code=404, detail="Audio file not found")

    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "message": "Queued for processing",
        "stems": request.stems,
        "scores": {},
    }

    background_tasks.add_task(run_job, job_id, audio_files[0], request.stems)
    return {"job_id": job_id}


@app.get("/status/{job_id}")
async def get_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    # Return everything except the internal file paths
    job = jobs[job_id]
    public_scores = {
        stem: [{"label": s["label"], "start_bar": s["start_bar"], "end_bar": s["end_bar"]}
               for s in snippets]
        for stem, snippets in job["scores"].items()
    }
    return {**job, "scores": public_scores}


@app.get("/score/{job_id}/{stem}/{snippet_index}")
async def get_score(job_id: str, stem: str, snippet_index: int):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    snippets = job.get("scores", {}).get(stem)
    if not snippets or snippet_index >= len(snippets):
        raise HTTPException(status_code=404, detail="Snippet not found")

    pdf_path = Path(snippets[snippet_index]["path"])
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found")

    label = snippets[snippet_index]["label"].replace(" ", "_").replace("–", "-")
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"{stem}_{label}.pdf",
    )


async def run_job(job_id: str, audio_path: Path, stems: list[str]):
    from processing.scorer import generate_score
    from processing.separator import separate_stems
    from processing.transcriber import transcribe_stem

    def update(status: str, message: str, progress: int):
        jobs[job_id].update(status=status, message=message, progress=progress)

    try:
        update("separating", "Separating instruments with Demucs…", 10)
        stem_paths = await asyncio.to_thread(separate_stems, audio_path, stems)

        scores: dict[str, list] = {}
        step = 80 // max(len(stems), 1)

        for i, stem in enumerate(stems):
            if stem not in stem_paths:
                continue

            update("transcribing", f"Transcribing {stem} to MIDI…", 20 + i * step)
            midi_path = await asyncio.to_thread(transcribe_stem, stem_paths[stem])

            update("scoring", f"Finding active bars and generating score for {stem}…",
                   20 + i * step + step // 2)
            snippets = await asyncio.to_thread(generate_score, midi_path, stem)
            scores[stem] = snippets

        jobs[job_id].update(
            status="complete",
            progress=100,
            message=f"Done! Found snippets for {len(scores)} stem(s).",
            scores=scores,
        )

    except Exception as exc:
        jobs[job_id].update(status="error", message=f"Error: {exc}", progress=0)
