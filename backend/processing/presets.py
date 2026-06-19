"""
Per-sound-type processing presets for a pro cover-band keyboardist.
All low cuts are aggressive (200Hz+) since there's a dedicated bass player.
"""

PRESETS: dict[str, dict] = {
    "piano": {
        "stem": "piano",          # uses htdemucs_6s dedicated piano stem
        "low_cut_hz": 120,
        "high_cut_hz": 5000,
        "onset_threshold": 0.60,
        "frame_threshold": 0.35,
        "minimum_note_length": 80,
        "min_pitch": 36,           # C2
        "max_pitch": 96,           # C7
    },
    "organ": {
        "stem": "other",
        "low_cut_hz": 120,
        "high_cut_hz": 4000,
        "onset_threshold": 0.55,
        "frame_threshold": 0.33,
        "minimum_note_length": 120,
        "min_pitch": 36,           # C2 — organ can go low
        "max_pitch": 96,
    },
    "ep": {                        # Rhodes, Wurlitzer, Clavinet
        "stem": "other",
        "low_cut_hz": 200,
        "high_cut_hz": 5000,
        "onset_threshold": 0.62,
        "frame_threshold": 0.36,
        "minimum_note_length": 80,
        "min_pitch": 40,           # E2
        "max_pitch": 96,
    },
    "strings": {                   # String pads, sweeps, orchestral strings
        "stem": "other",
        "low_cut_hz": 220,
        "high_cut_hz": 4500,
        "onset_threshold": 0.52,   # lower — strings have soft attacks
        "frame_threshold": 0.32,
        "minimum_note_length": 150, # longer — no short blips in strings
        "min_pitch": 48,            # C3
        "max_pitch": 93,            # A6
    },
    "brass": {                     # Horn stabs, pop brass, sax melody
        "stem": "other",
        "low_cut_hz": 220,
        "high_cut_hz": 3800,
        "onset_threshold": 0.68,   # high — brass is punchy and loud
        "frame_threshold": 0.42,
        "minimum_note_length": 70,
        "min_pitch": 48,            # C3
        "max_pitch": 89,            # F6
    },
    "accordion": {
        "stem": "other",
        "low_cut_hz": 200,
        "high_cut_hz": 3500,
        "onset_threshold": 0.60,
        "frame_threshold": 0.38,
        "minimum_note_length": 100,
        "min_pitch": 45,            # A2
        "max_pitch": 88,            # E6
    },
    "synth_lead": {
        "stem": "other",
        "low_cut_hz": 220,
        "high_cut_hz": 6000,        # leads can be bright
        "onset_threshold": 0.65,
        "frame_threshold": 0.40,
        "minimum_note_length": 60,
        "min_pitch": 48,
        "max_pitch": 100,           # E7
    },
    "synth_pad": {
        "stem": "other",
        "low_cut_hz": 160,
        "high_cut_hz": 4500,
        "onset_threshold": 0.50,   # pads have slow attacks, be generous
        "frame_threshold": 0.30,
        "minimum_note_length": 180,
        "min_pitch": 36,
        "max_pitch": 96,
    },
    "other": {                     # generic fallback
        "stem": "other",
        "low_cut_hz": 200,
        "high_cut_hz": 5000,
        "onset_threshold": 0.60,
        "frame_threshold": 0.36,
        "minimum_note_length": 100,
        "min_pitch": 36,
        "max_pitch": 100,
    },
}


def get_preset(sound_type: str) -> dict:
    return PRESETS.get(sound_type, PRESETS["other"])
