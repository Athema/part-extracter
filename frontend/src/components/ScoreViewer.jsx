import MidiPlayer from "./MidiPlayer";

export default function ScoreViewer({ jobId, regions, filename, onAddExtraction, onReset }) {
  const done = (regions ?? []).filter((r) => r.done);

  return (
    <div className="results">
      <div className="results-header">
        <div>
          <h2>Transcription ready</h2>
          <p className="text-muted">
            {filename} — {done.length} region{done.length !== 1 ? "s" : ""} · play to preview, download MIDI to import into MuseScore
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={onAddExtraction}>+ More regions</button>
          <button className="btn btn-ghost" onClick={onReset}>↩ New song</button>
        </div>
      </div>

      {(regions ?? []).map((region, i) => (
        region.done
          ? <MidiPlayer key={i} jobId={jobId} regionIndex={i} region={region} />
          : (
            <div key={i} className="midi-card">
              <div className="midi-card-header">
                <span className="text-muted" style={{ fontSize: "0.85rem" }}>
                  ⚠ {region.label} — no MIDI generated
                </span>
              </div>
            </div>
          )
      ))}
    </div>
  );
}
