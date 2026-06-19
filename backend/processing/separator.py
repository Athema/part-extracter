import subprocess
import sys
from pathlib import Path

# htdemucs_6s supports piano + guitar stems; htdemucs supports 4 stems
_6S_STEMS = {"piano", "guitar"}
_ALL_STEMS = {"drums", "bass", "vocals", "other", "piano", "guitar"}


def separate_stems(audio_path: Path, requested_stems: list[str]) -> dict[str, Path]:
    needs_6s = any(s in _6S_STEMS for s in requested_stems)
    model = "htdemucs_6s" if needs_6s else "htdemucs"

    output_dir = audio_path.parent / "stems"
    output_dir.mkdir(exist_ok=True)

    cmd = [
        sys.executable, "-m", "demucs",
        "-n", model,
        "-o", str(output_dir),
        str(audio_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Demucs failed:\n{result.stderr}")

    stems_dir = output_dir / model / audio_path.stem
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
