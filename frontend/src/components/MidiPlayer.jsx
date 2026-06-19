import { useEffect, useRef, useState } from "react";

const SOUND_TYPE_ICONS = {
  piano: "🎹", organ: "🎹", ep: "🎹",
  strings: "🎻", brass: "🎺", accordion: "🪗",
  synth_lead: "🎛", synth_pad: "🎛", other: "🎼",
};

const SOUND_TYPE_LABELS = {
  piano: "Piano", organ: "Organ", ep: "Electric Piano",
  strings: "Strings / Pads", brass: "Brass", accordion: "Accordion",
  synth_lead: "Synth Lead", synth_pad: "Synth Pad", other: "Other Keys",
};

function formatTime(secs) {
  if (!Number.isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function MidiPlayer({ jobId, regionIndex, region }) {
  const [state, setState] = useState("loading"); // loading | ready | playing | error
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const midiRef = useRef(null);
  const synthRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const toneRef = useRef(null);

  const url = `/midi/${jobId}/${regionIndex}`;

  useEffect(() => {
    let cancelled = false;
    setState("loading");

    async function loadMidi() {
      try {
        const { Midi } = await import("@tonejs/midi");
        const midi = await Midi.fromUrl(url);
        if (cancelled) return;
        midiRef.current = midi;
        const dur = Math.max(...midi.tracks.flatMap((t) => t.notes.map((n) => n.time + n.duration)));
        setDuration(Number.isFinite(dur) ? dur : 0);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    }

    loadMidi();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [url]);

  function cleanup() {
    clearInterval(timerRef.current);
    if (toneRef.current) {
      toneRef.current.Transport.stop();
      toneRef.current.Transport.cancel();
    }
    if (synthRef.current) {
      try { synthRef.current.dispose(); } catch {}
      synthRef.current = null;
    }
  }

  async function play() {
    if (!midiRef.current) return;
    cleanup();

    // Lazy-load Tone.js to keep initial bundle small
    const Tone = await import("tone");
    toneRef.current = Tone;
    await Tone.start();

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.8 },
      volume: -8,
    }).toDestination();
    synthRef.current = synth;

    const now = Tone.now() + 0.1;
    midiRef.current.tracks.forEach((track) => {
      track.notes.forEach((note) => {
        synth.triggerAttackRelease(note.name, note.duration, note.time + now, note.velocity);
      });
    });

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const secs = (Date.now() - startTimeRef.current) / 1000;
      setElapsed(secs);
      if (secs >= duration) {
        clearInterval(timerRef.current);
        setState("ready");
        setElapsed(0);
      }
    }, 100);

    setState("playing");
  }

  function stop() {
    cleanup();
    setState("ready");
    setElapsed(0);
  }

  const progress = duration > 0 ? Math.min((elapsed / duration) * 100, 100) : 0;
  const icon = SOUND_TYPE_ICONS[region.sound_type] ?? "🎼";
  const soundLabel = SOUND_TYPE_LABELS[region.sound_type] ?? region.sound_type ?? "Other Keys";
  const timeRange = `${formatTime(region.start_time)} – ${formatTime(region.end_time)}`;

  return (
    <div className="midi-card">
      <div className="midi-card-header">
        <div className="midi-card-title">
          <span>{icon}</span>
          <div>
            <div className="midi-label">{region.label}</div>
            <div className="midi-meta">{timeRange} · {soundLabel}</div>
          </div>
        </div>
        <div className="midi-actions">
          <button
            className={`btn ${state === "playing" ? "btn-ghost" : "btn-primary"}`}
            onClick={state === "playing" ? stop : play}
            disabled={state === "loading" || state === "error"}
          >
            {state === "loading" ? "Loading…"
              : state === "error" ? "Error"
              : state === "playing" ? "⏹ Stop"
              : "▶ Play"}
          </button>
          <a className="btn btn-ghost" href={url} download={`${region.label}.mid`}>
            ⬇ MIDI
          </a>
        </div>
      </div>

      {(state === "playing" || elapsed > 0) && (
        <div className="midi-progress">
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="midi-time">
            {formatTime(elapsed)} / {formatTime(duration)}
          </div>
        </div>
      )}
    </div>
  );
}
