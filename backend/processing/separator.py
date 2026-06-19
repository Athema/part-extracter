import re
import subprocess
import sys
from pathlib import Path

# htdemucs_6s supports piano + guitar stems; htdemucs supports 4 stems
_6S_STEMS = {"piano", "guitar"}
_ALL_STEMS = {"drums", "bass", "vocals", "other", "piano", "guitar"}


def _slug(label: str) -> str:
    """Convert a region label to a safe folder name."""
    return re.sub(r"[^\w-]", "_", label)


def separate_stems(
    audio_path: Path,
    requested_stems: list[str],
    start_time: float = 0.0,
    end_time: float | None = None,
    region_label: str = "",
) -> dict[str, Path]:
    import torchaudio

    needs_6s = any(s in _6S_STEMS for s in requested_stems)
    model = "htdemucs_6s" if needs_6s else "htdemucs"

    # --- Trim audio to [start_time, end_time] if a region is specified ---
    if end_time is not None or start_time > 0.0:
        waveform, sr = torchaudio.load(str(audio_path))
        start_sample = int(start_time * sr)
        end_sample = int(end_time * sr) if end_time is not None else waveform.shape[1]
        trimmed = waveform[:, start_sample:end_sample]

        slug = _slug(region_label) if region_label else "region"
        trimmed_path = audio_path.parent / f"trimmed_{slug}{audio_path.suffix}"
        torchaudio.save(str(trimmed_path), trimmed, sr)
        source_path = trimmed_path
    else:
        source_path = audio_path

    slug = _slug(region_label) if region_label else "stems"
    output_dir = audio_path.parent / f"stems_{slug}"
    output_dir.mkdir(exist_ok=True)

    cmd = [
        sys.executable, "-m", "demucs",
        "-n", model,
        "-o", str(output_dir),
        str(source_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Demucs failed:\n{result.stderr}")

    stems_dir = output_dir / model / source_path.stem
    if not stems_dir.exists():
        # Demucs sometimes sanitises the folder name
        candidates = list((output_dir / model).iterdir())
        if not candidates:
            raise RuntimeError("Demucs produced no output folder")
        stems_dir = candidates[0]

    return {
        stem: stems_dir / f"{stem}.wav"
        for stem in requested_stems
        if (stems_dir / f"{stem}.wav").exists()
    }
