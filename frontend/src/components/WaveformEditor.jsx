import { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";

const STEMS = [
  { id: "other",  label: "Keys / Other",  note: "Synths, pads, organs" },
  { id: "piano",  label: "Piano",         note: "Acoustic/electric piano" },
  { id: "guitar", label: "Guitar",        note: "" },
  { id: "bass",   label: "Bass",          note: "" },
  { id: "vocals", label: "Vocals",        note: "" },
  { id: "drums",  label: "Drums",         note: "" },
];

// A palette of accent colors that look good on the dark theme
const REGION_COLORS = [
  "rgba(124, 106, 247, 0.35)",
  "rgba(251, 113, 133, 0.35)",
  "rgba(52, 211, 153, 0.35)",
  "rgba(251, 191,  36, 0.35)",
  "rgba( 56, 189, 248, 0.35)",
  "rgba(232, 121, 249, 0.35)",
  "rgba(249, 115,  22, 0.35)",
];

// Same palette but opaque for swatches
const SWATCH_COLORS = [
  "#7c6af7",
  "#fb7185",
  "#34d399",
  "#fbbf24",
  "#38bdf8",
  "#e879f9",
  "#f97316",
];

let colorIndex = 0;
function nextColor() {
  const i = colorIndex % REGION_COLORS.length;
  colorIndex++;
  return { bg: REGION_COLORS[i], solid: SWATCH_COLORS[i] };
}

function formatTime(secs) {
  if (!Number.isFinite(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

let regionCounter = 0;

export default function WaveformEditor({ fileId, filename, audioUrl, onSubmit, onBack }) {
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const regionsPluginRef = useRef(null);
  const durationRef = useRef(0);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [regionList, setRegionList] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Keep durationRef in sync for use in callbacks that close over stale state
  useEffect(() => { durationRef.current = duration; }, [duration]);

  useEffect(() => {
    if (!containerRef.current) return;

    colorIndex = 0;
    regionCounter = 0;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#2e2e4d",
      progressColor: "#7c6af7",
      cursorColor: "#a594ff",
      cursorWidth: 2,
      url: audioUrl,
      height: 80,
      normalize: true,
      interact: true,
    });

    const regionsPlugin = ws.registerPlugin(RegionsPlugin.create());
    wsRef.current = ws;
    regionsPluginRef.current = regionsPlugin;

    ws.on("ready", (dur) => {
      setDuration(dur);
      durationRef.current = dur;
      setIsReady(true);
    });

    ws.on("timeupdate", (t) => setCurrentTime(t));
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));

    // User drags on waveform to create region
    regionsPlugin.enableDragSelection({ color: "rgba(124,106,247,0.3)" });

    regionsPlugin.on("region-created", (region) => {
      regionCounter++;
      const { bg, solid } = nextColor();
      region.setOptions({ color: bg, drag: true, resize: true });

      const id = region.id;
      setRegionList((prev) => [
        ...prev,
        {
          id,
          label: `Region ${regionCounter}`,
          stem: "other",
          start: region.start,
          end: region.end,
          color: solid,
          wsRegion: region,
        },
      ]);
    });

    regionsPlugin.on("region-updated", (region) => {
      setRegionList((prev) =>
        prev.map((r) =>
          r.id === region.id ? { ...r, start: region.start, end: region.end } : r
        )
      );
    });

    regionsPlugin.on("region-clicked", (region, e) => {
      e.stopPropagation();
      region.play();
    });

    return () => {
      ws.destroy();
      wsRef.current = null;
      regionsPluginRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  const togglePlay = useCallback(() => {
    wsRef.current?.playPause();
  }, []);

  const seekToStart = useCallback(() => {
    wsRef.current?.seekTo(0);
    wsRef.current?.pause();
  }, []);

  const updateLabel = useCallback((id, label) => {
    setRegionList((prev) => prev.map((r) => (r.id === id ? { ...r, label } : r)));
  }, []);

  const updateStem = useCallback((id, stem) => {
    setRegionList((prev) => prev.map((r) => (r.id === id ? { ...r, stem } : r)));
  }, []);

  const deleteRegion = useCallback((id) => {
    setRegionList((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target?.wsRegion) {
        try { target.wsRegion.remove(); } catch (_) { /* already gone */ }
      }
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const addRegion = useCallback(() => {
    if (!regionsPluginRef.current || !isReady) return;
    const dur = durationRef.current;
    const span = dur * 0.1;
    const start = dur * 0.1;
    const end = start + span;

    regionCounter++;
    const { bg, solid } = nextColor();

    const wsRegion = regionsPluginRef.current.addRegion({
      start,
      end,
      color: bg,
      drag: true,
      resize: true,
    });

    setRegionList((prev) => [
      ...prev,
      {
        id: wsRegion.id,
        label: `Region ${regionCounter}`,
        stem: "other",
        start,
        end,
        color: solid,
        wsRegion,
      },
    ]);
  }, [isReady]);

  const handleSubmit = useCallback(async () => {
    if (regionList.length === 0 || submitting) return;
    setSubmitting(true);
    const payload = regionList.map((r) => ({
      label: r.label,
      stem: r.stem,
      start_time: parseFloat(r.start.toFixed(3)),
      end_time: parseFloat(r.end.toFixed(3)),
    }));
    await onSubmit(payload);
    setSubmitting(false);
  }, [regionList, onSubmit, submitting]);

  return (
    <div className="waveform-editor">
      {/* Header */}
      <div className="waveform-editor-header">
        <div>
          <h2 className="waveform-title">Select regions</h2>
          <p className="waveform-subtitle">
            {filename} — drag on the waveform to mark parts, then label each one
          </p>
        </div>
        <button className="btn btn-ghost" onClick={onBack}>
          ↩ Change song
        </button>
      </div>

      {/* Waveform */}
      <div className="waveform-surface">
        {!isReady && (
          <div className="waveform-loading">
            <div className="spinner" />
            <span>Loading waveform…</span>
          </div>
        )}
        <div
          ref={containerRef}
          className="waveform-container"
          style={{ opacity: isReady ? 1 : 0 }}
        />

        {/* Transport controls */}
        {isReady && (
          <div className="waveform-toolbar">
            <div className="waveform-transport">
              <button
                className="transport-btn"
                onClick={seekToStart}
                title="Rewind to start"
                aria-label="Rewind to start"
              >
                ⏮
              </button>
              <button
                className="transport-btn transport-btn--play"
                onClick={togglePlay}
                title={isPlaying ? "Pause" : "Play"}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? "⏸" : "▶"}
              </button>
            </div>
            <span className="waveform-time">
              {formatTime(currentTime)}
              <span className="waveform-time-sep">/</span>
              {formatTime(duration)}
            </span>
            <span className="waveform-hint">
              Drag on waveform to create a region · Click region to preview
            </span>
          </div>
        )}
      </div>

      {/* Region list */}
      <div className="regions-panel">
        <div className="regions-panel-header">
          <h3 className="regions-panel-title">
            Regions
            {regionList.length > 0 && (
              <span className="regions-count">{regionList.length}</span>
            )}
          </h3>
          <button
            className="btn btn-ghost"
            onClick={addRegion}
            disabled={!isReady}
          >
            + Add region
          </button>
        </div>

        {regionList.length === 0 ? (
          <div className="regions-empty">
            No regions yet — drag on the waveform above to create one
          </div>
        ) : (
          <div className="regions-list">
            {regionList.map((r) => (
              <div key={r.id} className="region-row">
                <div
                  className="region-color-dot"
                  style={{ background: r.color }}
                />
                <input
                  className="region-label-input"
                  type="text"
                  value={r.label}
                  onChange={(e) => updateLabel(r.id, e.target.value)}
                  placeholder="Region name"
                  aria-label="Region label"
                />
                <span className="region-time">
                  {formatTime(r.start)} – {formatTime(r.end)}
                </span>
                <select
                  className="region-stem-select"
                  value={r.stem}
                  onChange={(e) => updateStem(r.id, e.target.value)}
                  aria-label="Instrument"
                >
                  {STEMS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  className="region-delete-btn"
                  onClick={() => deleteRegion(r.id)}
                  title="Remove region"
                  aria-label="Remove region"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="waveform-footer">
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={regionList.length === 0 || submitting || !isReady}
        >
          {submitting
            ? "Submitting…"
            : `Extract ${regionList.length} region${regionList.length !== 1 ? "s" : ""} →`}
        </button>
      </div>
    </div>
  );
}
