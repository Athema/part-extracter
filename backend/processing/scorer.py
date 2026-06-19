import copy
from pathlib import Path

_CLEFS = {
    "bass": "bass",
    "drums": "percussion",
    "vocals": "treble",
    "other": "treble",
    "piano": "treble",
    "guitar": "treble",
}

# Consecutive empty bars allowed within a single snippet before we split
_GAP_TOLERANCE = 2


def generate_score(midi_path: Path, stem_name: str) -> list[dict]:
    """
    Convert MIDI to PDF snippets — one PDF per active section (bars where
    the instrument is actually playing). Returns a list of dicts:
      [{"path": str, "label": "Bars 4–12", "start_bar": 4, "end_bar": 12}, ...]
    """
    import music21

    output_dir = midi_path.parent.parent / "scores" / stem_name
    output_dir.mkdir(parents=True, exist_ok=True)

    score = music21.converter.parse(str(midi_path))
    clef_type = _CLEFS.get(stem_name, "treble")

    ranges = _find_active_ranges(score)
    if not ranges:
        ranges = _full_range(score)

    results = []
    for i, (start, end) in enumerate(ranges):
        snippet = _extract_measures(score, start, end, clef_type, stem_name)
        base = output_dir / f"snippet_{i + 1}"
        snippet.write("lily.pdf", fp=str(base))

        pdf = Path(str(base) + ".pdf")
        if not pdf.exists():
            pdf = output_dir / f"snippet_{i + 1}.pdf"
        if pdf.exists():
            results.append({
                "path": str(pdf),
                "label": f"Bars {start}–{end}",
                "start_bar": start,
                "end_bar": end,
            })

    return results


def _find_active_ranges(score) -> list[tuple[int, int]]:
    """Return sorted list of (start_bar, end_bar) for bars with actual notes."""
    import music21

    active = set()
    for part in score.parts:
        for measure in part.getElementsByClass("Measure"):
            has_notes = any(
                isinstance(el, (music21.note.Note, music21.chord.Chord))
                for el in measure.flatten().notes
            )
            if has_notes:
                active.add(measure.number)

    if not active:
        return []

    sorted_bars = sorted(active)
    ranges: list[tuple[int, int]] = []
    start = prev = sorted_bars[0]

    for bar in sorted_bars[1:]:
        if bar - prev <= _GAP_TOLERANCE + 1:
            prev = bar
        else:
            ranges.append((start, prev))
            start = prev = bar

    ranges.append((start, prev))
    return ranges


def _full_range(score) -> list[tuple[int, int]]:
    numbers = [
        m.number
        for part in score.parts
        for m in part.getElementsByClass("Measure")
    ]
    return [(min(numbers), max(numbers))] if numbers else [(1, 1)]


def _extract_measures(score, start: int, end: int, clef_type: str, stem_name: str):
    """Build a new Score containing only measures start..end."""
    import music21

    new_score = music21.stream.Score()

    for part in score.parts:
        new_part = music21.stream.Part()
        new_part.partName = stem_name.capitalize()
        first = True

        for measure in part.getElementsByClass("Measure"):
            if start <= measure.number <= end:
                m = copy.deepcopy(measure)
                if first:
                    if clef_type == "bass":
                        clef_obj = music21.clef.BassClef()
                    elif clef_type == "percussion":
                        clef_obj = music21.clef.PercussionClef()
                    else:
                        clef_obj = music21.clef.TrebleClef()
                    m.insert(0, clef_obj)
                    first = False
                new_part.append(m)

        if not first:
            new_score.append(new_part)

    return new_score
