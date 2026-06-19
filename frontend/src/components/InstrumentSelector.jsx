import { useState } from "react";

const STEMS = [
  { id: "other",   icon: "🎹", name: "Keys / Other",  note: "Synths, pads, organs" },
  { id: "piano",   icon: "🎹", name: "Piano",          note: "Requires 6-stem model" },
  { id: "bass",    icon: "🎸", name: "Bass",           note: "Bass guitar / synth bass" },
  { id: "guitar",  icon: "🎸", name: "Guitar",         note: "Requires 6-stem model" },
  { id: "vocals",  icon: "🎤", name: "Vocals",         note: "Lead & backing vocals" },
  { id: "drums",   icon: "🥁", name: "Drums",          note: "Full drum kit" },
];

export default function InstrumentSelector({ filename, onSubmit }) {
  const [selected, setSelected] = useState(new Set(["other"]));

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  return (
    <div className="stem-selector">
      <h2>Which parts do you need?</h2>
      <p className="subtitle">
        Loaded: <strong>{filename}</strong> — select every instrument you want a score for.
      </p>

      <div className="stem-grid">
        {STEMS.map((s) => (
          <div
            key={s.id}
            className={`stem-card ${selected.has(s.id) ? "selected" : ""}`}
            onClick={() => toggle(s.id)}
          >
            <span className="stem-icon">{s.icon}</span>
            <span className="stem-name">{s.name}</span>
            <span className="stem-note">{s.note}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          className="btn btn-primary"
          disabled={selected.size === 0}
          onClick={() => onSubmit([...selected])}
        >
          Extract {selected.size} part{selected.size !== 1 ? "s" : ""} →
        </button>
        <span className="text-muted" style={{ alignSelf: "center" }}>
          This may take a few minutes
        </span>
      </div>
    </div>
  );
}
