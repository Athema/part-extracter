# Part Extracter — Product Spec

## 1. User Persona and Problem Statement

### Persona

**The Professional Cover Band Keyboardist**

A gigging musician who plays keyboards in a cover band. They are responsible for covering ALL keyboard parts in any given song — piano, organ, synth strings, brass stabs, accordion, pads, solos. They are not a transcriptionist; they are a performer who needs just enough notation to nail the parts that matter.

### Problem Statement

When learning a cover song, a keyboardist receives a reference audio track. Full commercial transcriptions are rarely available, and when they are, they include everything — all instruments, all bars — making them impractical for quickly learning specific keyboard moments. Transcribing by ear is time-consuming, and the keyboardist usually only needs a handful of moments from a song: the brass stab in bar 8, the string intro, the synth riff in the chorus.

**The core need:** Given an audio track, extract only the keyboard parts the player actually needs to perform, presented as concise sheet music snippets — not a full-song transcription.

---

## 2. Core User Stories

- As a keyboardist, I want to upload a song and listen to it in the browser so that I can identify the moments I need to cover.
- As a keyboardist, I want to drag-select a region of the waveform (e.g. 0:32–0:45) so that I can isolate just the part I care about.
- As a keyboardist, I want to label each region (e.g. "Brass intro", "String pad") so that the output PDF is clearly organized.
- As a keyboardist, I want to choose which instrument stem to extract per region (keys, piano, guitar, bass, etc.) so that I get the right instrument isolated for each moment.
- As a keyboardist, I want to create multiple regions from one song and extract them all in one click so that I can process an entire setlist entry efficiently.
- As a keyboardist, I want to receive one PDF score snippet per region so that I can print or display only the bars I need to perform.
- As a keyboardist, I want the score to show only the bars that contain actual notes so that there is no wasted whitespace or empty measures.
- As a keyboardist, I want to see real-time progress during extraction so that I know the job is running and roughly how long it will take.

---

## 3. Region-Based Extraction Workflow

### Step-by-Step Flow

**Step 1 — Upload**
The user uploads an audio file (MP3, WAV, FLAC, etc.). The server assigns a `file_id` and stores the file. The frontend receives the `file_id` and audio URL for playback.

**Step 2 — Waveform Player**
The frontend renders an interactive waveform (e.g. using WaveSurfer.js). The user can play, pause, and scrub through the track to find the moments they need.

**Step 3 — Select Regions**
The user drags across the waveform to highlight a time range. Each drag creates a labeled region block on the waveform. The user can:
- Create as many regions as needed from one song
- Reposition or resize a region after creating it
- Delete a region

**Step 4 — Configure Each Region**
For each region, the user sets:
- **Label** — a human-readable name (e.g. "Brass intro", "Synth riff B section"). Defaults to a timestamp label if left blank.
- **Stem** — which instrument layer to extract (see Section 5). This determines which Demucs model and stem output is used.

Typical region duration: 5–30 seconds.

**Step 5 — Submit**
The user clicks "Extract all regions". The frontend POSTs to `/process` with the `file_id` and the full list of region definitions (label, stem, start_time, end_time). The server returns a `job_id`.

**Step 6 — Progress Tracking**
The frontend polls `GET /status/{job_id}` to show real-time progress. The status moves through:
`queued` → `separating` → `transcribing` → `scoring` → `complete` (or `error`)

A progress bar and status message keep the user informed.

**Step 7 — Results**
When status is `complete`, the frontend displays each region with its label. Each region may contain one or more score snippets (contiguous bars of notes). The user can download each snippet as a PDF via `GET /score/{job_id}/{region_index}/{snippet_index}`.

**Step 8 — Usage**
The keyboardist prints or loads the PDF on their tablet/stand and uses it at rehearsal or on the gig.

---

## 4. API Contract

### POST /process

Initiates extraction for one or more regions of a previously uploaded file.

**Request body:**
```json
{
  "file_id": "uuid",
  "regions": [
    {
      "label": "Brass intro",
      "stem": "other",
      "start_time": 32.5,
      "end_time": 45.0
    },
    {
      "label": "String pad",
      "stem": "other",
      "start_time": 65.0,
      "end_time": 88.0
    }
  ]
}
```

**Response:**
```json
{ "job_id": "uuid" }
```

---

### GET /status/{job_id}

Polls the current state of a processing job.

**Response:**
```json
{
  "status": "queued|separating|transcribing|scoring|complete|error",
  "progress": 0,
  "message": "Human-readable status message",
  "regions": [
    {
      "label": "Brass intro",
      "stem": "other",
      "start_time": 32.5,
      "end_time": 45.0,
      "snippets": [
        { "label": "Bars 1–4", "start_bar": 1, "end_bar": 4 }
      ]
    }
  ]
}
```

- `status`: machine-readable pipeline stage
- `progress`: integer 0–100
- `message`: displayed to the user in the UI
- `regions[].snippets`: populated only when status is `complete`; each snippet represents a contiguous group of bars containing notes

---

### GET /score/{job_id}/{region_index}/{snippet_index}

Downloads a single score snippet as a PDF.

- `region_index`: zero-based index into the `regions` array submitted in `/process`
- `snippet_index`: zero-based index into the `snippets` array from `/status`

**Response:** PDF file (binary), `Content-Type: application/pdf`

---

## 5. Stem Options

Each region is assigned a stem type, which determines which Demucs model is used and which output layer is extracted. This lets the user target the specific instrument they need to transcribe.

| Stem value | What it isolates | Demucs model |
|---|---|---|
| `other` | Keys, synths, pads, brass, misc non-guitar/bass/drums | htdemucs (4-stem) |
| `piano` | Dedicated acoustic/electric piano | htdemucs_6s (6-stem) |
| `guitar` | Guitar (electric or acoustic) | htdemucs_6s (6-stem) |
| `bass` | Bass guitar or synth bass | htdemucs (4-stem) |
| `vocals` | Lead and backing vocals | htdemucs (4-stem) |
| `drums` | Full drum kit | htdemucs (4-stem) |

**Guidance for keyboardists:**
- Use `other` for synths, strings, organ, brass stabs, pads, and anything that is not clearly piano or guitar.
- Use `piano` when the part is clearly an acoustic or Rhodes-style piano sound with distinct articulation — the 6-stem model gives better separation in these cases.
- Use `guitar` if you are doubling a guitar riff on keys and want to transcribe the guitar line as a reference.

---

## 6. Future Ideas

### Time-Stamped Annotations
Allow the user to drop marker pins on the waveform (rather than drag regions) to mark moments like "stab here", "fill", "out". These could generate very short snippets (1–2 bars) for quick hits rather than sustained passages.

### Patch / Sound Suggestions
Analyze the timbral characteristics of the extracted stem and suggest a synthesizer patch category (e.g. "Brass ensemble", "Soft pad", "Drawbar organ"). This helps the keyboardist dial in their sound quickly, especially for unfamiliar songs.

### Transposition
Allow the user to specify a target key or transposition interval before generating the PDF. Useful when the band plays a song in a different key from the original recording, or when the keyboardist wants to read the part in concert pitch vs. transposed.

### Chord Symbol Overlay
Detect chords in the extracted region and overlay chord symbols above the staff in the PDF. Helps the keyboardist understand harmonic context and improvise fills around the core riff.

### Export to MIDI
Alongside the PDF, offer a downloadable MIDI file for each region so the keyboardist can import it into a DAW or notation app for further editing.

### Setlist Mode
Group multiple songs into a setlist. Process all songs in batch and receive a single organized PDF booklet with labeled sections per song — the keyboardist's complete performance guide for a night's gig.

### Confidence Indicators
Surface a confidence score on the PDF (low / medium / high) based on the clarity of the source separation and MIDI transcription. Low-confidence regions can be flagged so the keyboardist knows to double-check by ear before trusting the notation.
