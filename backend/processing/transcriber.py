from pathlib import Path


def transcribe_stem(audio_path: Path) -> Path:
    from basic_pitch import ICASSP_2022_MODEL_PATH
    from basic_pitch.inference import predict_and_save

    output_dir = audio_path.parent / "midi"
    output_dir.mkdir(exist_ok=True)

    predict_and_save(
        audio_path_list=[str(audio_path)],
        output_directory=str(output_dir),
        save_midi=True,
        sonify_midi=False,
        save_model_outputs=False,
        save_notes=False,
        model_or_model_path=ICASSP_2022_MODEL_PATH,
    )

    # Basic Pitch names files as {stem}_basic_pitch.mid
    midi_file = output_dir / f"{audio_path.stem}_basic_pitch.mid"
    if not midi_file.exists():
        candidates = list(output_dir.glob("*.mid"))
        if not candidates:
            raise RuntimeError("Basic Pitch produced no MIDI file")
        midi_file = candidates[0]

    return midi_file
