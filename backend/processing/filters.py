from pathlib import Path

import torch
import torchaudio
import torchaudio.functional as AF


def apply_bandpass(audio_path: Path, low_hz: float, high_hz: float, output_path: Path) -> Path:
    """Apply high-pass then low-pass biquad filters (bandpass) using torchaudio."""
    waveform, sr = torchaudio.load(str(audio_path))

    # High-pass (low cut) — removes rumble and bass bleed
    waveform = AF.highpass_biquad(waveform, sr, cutoff_freq=low_hz, Q=0.707)
    # Low-pass (high cut) — removes hiss, cymbals bleed, ultra-high artifacts
    waveform = AF.lowpass_biquad(waveform, sr, cutoff_freq=min(high_hz, sr / 2 - 1), Q=0.707)

    torchaudio.save(str(output_path), waveform, sr)
    return output_path


def filter_midi(midi_path: Path, min_pitch: int, max_pitch: int, min_duration_ms: float = 80) -> Path:
    """
    Post-process a MIDI file:
      - Drop notes outside [min_pitch, max_pitch]
      - Drop notes shorter than min_duration_ms
    Overwrites in place (or saves to same path) and returns it.
    """
    import mido

    mid = mido.MidiFile(str(midi_path))
    ticks_per_beat = mid.ticks_per_beat

    new_mid = mido.MidiFile(ticks_per_beat=ticks_per_beat, type=mid.type)

    for track in mid.tracks:
        new_track = mido.MidiTrack()
        new_mid.tracks.append(new_track)

        # First pass: resolve absolute times and collect note events
        abs_time = 0
        note_on_at: dict[int, int] = {}  # pitch → abs tick when note_on fired
        events = []  # (abs_tick, msg)

        for msg in track:
            abs_time += msg.time
            events.append((abs_time, msg))
            if msg.type == "note_on" and msg.velocity > 0:
                note_on_at[msg.note] = abs_time
            elif msg.type in ("note_off", "note_on") and (msg.type == "note_off" or msg.velocity == 0):
                note_on_at.pop(msg.note, None)

        # Determine tempo (default 120 BPM)
        tempo = 500_000  # microseconds per beat
        for _, msg in events:
            if msg.type == "set_tempo":
                tempo = msg.tempo
                break

        def ticks_to_ms(ticks: int) -> float:
            return ticks * (tempo / ticks_per_beat) / 1000

        # Second pass: find durations and decide which note_on/off pairs to keep
        note_on_abs: dict[int, int] = {}
        keep_notes: set[tuple[int, int]] = set()  # (pitch, on_abs_tick)

        for abs_tick, msg in events:
            if msg.type == "note_on" and msg.velocity > 0:
                note_on_abs[msg.note] = abs_tick
            elif msg.type in ("note_off", "note_on") and (msg.type == "note_off" or msg.velocity == 0):
                on_tick = note_on_abs.pop(msg.note, None)
                if on_tick is not None:
                    duration_ms = ticks_to_ms(abs_tick - on_tick)
                    in_range = min_pitch <= msg.note <= max_pitch
                    long_enough = duration_ms >= min_duration_ms
                    if in_range and long_enough:
                        keep_notes.add((msg.note, on_tick))

        # Third pass: rebuild track keeping only accepted notes
        note_on_abs2: dict[int, int] = {}
        filtered: list[tuple[int, mido.Message]] = []

        for abs_tick, msg in events:
            if msg.type not in ("note_on", "note_off"):
                filtered.append((abs_tick, msg))
                continue

            is_on = msg.type == "note_on" and msg.velocity > 0
            if is_on:
                note_on_abs2[msg.note] = abs_tick
                if (msg.note, abs_tick) in keep_notes:
                    filtered.append((abs_tick, msg))
            else:
                on_tick = note_on_abs2.pop(msg.note, None)
                if on_tick is not None and (msg.note, on_tick) in keep_notes:
                    filtered.append((abs_tick, msg))

        # Convert back to delta times
        prev = 0
        for abs_tick, msg in sorted(filtered, key=lambda x: x[0]):
            delta = abs_tick - prev
            prev = abs_tick
            new_track.append(msg.copy(time=delta))

    out_path = midi_path.with_stem(midi_path.stem + "_filtered")
    new_mid.save(str(out_path))
    return out_path
