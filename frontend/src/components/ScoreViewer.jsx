import { useState } from "react";

const STEM_ICONS = {
  other: "🎹", piano: "🎹", bass: "🎸", guitar: "🎸", vocals: "🎤", drums: "🥁",
};

function SnippetCard({ jobId, stem, snippet, index }) {
  const [open, setOpen] = useState(index === 0);
  const url = `/score/${jobId}/${stem}/${index}`;

  return (
    <div className="snippet-card">
      <div className="snippet-header" onClick={() => setOpen((o) => !o)}>
        <span className="snippet-label">
          {open ? "▾" : "▸"} {snippet.label}
        </span>
        <a
          className="btn btn-primary"
          href={url}
          download={`${stem}_${snippet.label.replace(/\s/g, "_")}.pdf`}
          onClick={(e) => e.stopPropagation()}
        >
          ⬇ PDF
        </a>
      </div>
      {open && (
        <iframe
          className="pdf-frame"
          src={url}
          title={`${stem} ${snippet.label}`}
        />
      )}
    </div>
  );
}

export default function ScoreViewer({ jobId, scores, filename, onAddExtraction, onReset }) {
  const stems = Object.keys(scores);
  const totalSnippets = stems.reduce((n, s) => n + scores[s].length, 0);

  return (
    <div className="results">
      <div className="results-header">
        <div>
          <h2>✅ Scores ready</h2>
          <p className="text-muted">
            {filename} — {totalSnippets} snippet{totalSnippets !== 1 ? "s" : ""} across {stems.length} part{stems.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={onAddExtraction}>
            + Extract more parts
          </button>
          <button className="btn btn-ghost" onClick={onReset}>
            ↩ New song
          </button>
        </div>
      </div>

      {stems.map((stem) => (
        <div key={stem} className="score-card">
          <div className="score-card-header">
            <span className="score-card-title">
              <span className="icon">{STEM_ICONS[stem] ?? "🎼"}</span>
              {stem.charAt(0).toUpperCase() + stem.slice(1)}
              <span className="text-muted" style={{ fontWeight: 400 }}>
                — {scores[stem].length} snippet{scores[stem].length !== 1 ? "s" : ""}
              </span>
            </span>
          </div>

          <div className="snippets-list">
            {scores[stem].map((snippet, i) => (
              <SnippetCard
                key={i}
                jobId={jobId}
                stem={stem}
                snippet={snippet}
                index={i}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
