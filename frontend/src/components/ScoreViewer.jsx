import { useState } from "react";

const STEM_ICONS = {
  other: "🎹", piano: "🎹", bass: "🎸", guitar: "🎸", vocals: "🎤", drums: "🥁",
};

function formatTime(secs) {
  if (!Number.isFinite(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function SnippetCard({ jobId, regionIndex, snippet, snippetIndex }) {
  const [open, setOpen] = useState(snippetIndex === 0);
  const url = `/score/${jobId}/${regionIndex}/${snippetIndex}`;

  return (
    <div className="snippet-card">
      <div className="snippet-header" onClick={() => setOpen((o) => !o)}>
        <span className="snippet-label">
          {open ? "▾" : "▸"} {snippet.label}
        </span>
        <a
          className="btn btn-primary"
          href={url}
          download={`region_${regionIndex}_${snippet.label.replace(/\s/g, "_")}.pdf`}
          onClick={(e) => e.stopPropagation()}
        >
          ⬇ PDF
        </a>
      </div>
      {open && (
        <iframe
          className="pdf-frame"
          src={url}
          title={`Region ${regionIndex} — ${snippet.label}`}
        />
      )}
    </div>
  );
}

function RegionCard({ jobId, region, regionIndex }) {
  const totalSnippets = region.snippets?.length ?? 0;
  const icon = STEM_ICONS[region.stem] ?? "🎼";
  const timeRange = `${formatTime(region.start_time)} – ${formatTime(region.end_time)}`;

  return (
    <div className="score-card">
      <div className="score-card-header">
        <span className="score-card-title">
          <span className="icon">{icon}</span>
          {region.label}
          <span className="text-muted" style={{ fontWeight: 400 }}>
            — {totalSnippets} snippet{totalSnippets !== 1 ? "s" : ""}
          </span>
        </span>
        <span className="score-card-time text-muted">{timeRange}</span>
      </div>

      <div className="snippets-list">
        {totalSnippets === 0 ? (
          <p className="text-muted" style={{ padding: "0.75rem 1rem", fontSize: "0.85rem" }}>
            No snippets generated for this region.
          </p>
        ) : (
          region.snippets.map((snippet, si) => (
            <SnippetCard
              key={si}
              jobId={jobId}
              regionIndex={regionIndex}
              snippet={snippet}
              snippetIndex={si}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function ScoreViewer({ jobId, regions, filename, onAddExtraction, onReset }) {
  const totalSnippets = (regions ?? []).reduce(
    (n, r) => n + (r.snippets?.length ?? 0),
    0
  );
  const regionCount = regions?.length ?? 0;

  return (
    <div className="results">
      <div className="results-header">
        <div>
          <h2>Scores ready</h2>
          <p className="text-muted">
            {filename} — {totalSnippets} snippet{totalSnippets !== 1 ? "s" : ""} across{" "}
            {regionCount} region{regionCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={onAddExtraction}>
            + Extract more regions
          </button>
          <button className="btn btn-ghost" onClick={onReset}>
            ↩ New song
          </button>
        </div>
      </div>

      {regionCount === 0 ? (
        <div className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>
          No regions returned by the server.
        </div>
      ) : (
        (regions ?? []).map((region, ri) => (
          <RegionCard key={ri} jobId={jobId} region={region} regionIndex={ri} />
        ))
      )}
    </div>
  );
}
