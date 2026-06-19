import { useCallback, useEffect, useRef, useState } from "react";
import AudioUploader from "./components/AudioUploader";
import WaveformEditor from "./components/WaveformEditor";
import ProgressTracker from "./components/ProgressTracker";
import ScoreViewer from "./components/ScoreViewer";

const POLL_INTERVAL = 2500;

export default function App() {
  const [phase, setPhase] = useState("upload"); // upload | waveform | processing | results | error
  const [fileId, setFileId] = useState(null);
  const [filename, setFilename] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [jobData, setJobData] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  // ── Poll job status ──
  useEffect(() => {
    if (phase !== "processing" || !jobId) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/status/${jobId}`);
        const data = await res.json();
        setJobData(data);
        if (data.status === "complete") {
          clearInterval(pollRef.current);
          setPhase("results");
        } else if (data.status === "error") {
          clearInterval(pollRef.current);
          setError(data.message);
          setPhase("error");
        }
      } catch {
        // network blip, keep polling
      }
    }, POLL_INTERVAL);

    return () => clearInterval(pollRef.current);
  }, [phase, jobId]);

  const handleUploaded = useCallback((id, name) => {
    setFileId(id);
    setFilename(name);
    setAudioUrl(`/audio/${id}`);
    setPhase("waveform");
  }, []);

  // regions: [{ label, sound_type, start_time, end_time }]
  const handleSubmit = useCallback(async (regions) => {
    setPhase("processing");
    setJobData({ status: "queued", progress: 0, message: "Starting…" });
    try {
      const res = await fetch("/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId, regions }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.statusText}`);
      const { job_id } = await res.json();
      setJobId(job_id);
    } catch (err) {
      setError(err.message);
      setPhase("error");
    }
  }, [fileId]);

  // Return to waveform editor with the same file — lets users extract more regions
  const handleAddExtraction = useCallback(() => {
    setJobId(null);
    setJobData(null);
    setPhase("waveform");
  }, []);

  const handleReset = useCallback(() => {
    setFileId(null);
    setFilename("");
    setAudioUrl(null);
    setJobId(null);
    setJobData(null);
    setError(null);
    setPhase("upload");
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>Part Extracter</h1>
        <p>Upload a song — mark the regions you need — get a score for each part</p>
      </header>

      {phase === "upload" && <AudioUploader onUploaded={handleUploaded} />}

      {phase === "waveform" && (
        <WaveformEditor
          fileId={fileId}
          filename={filename}
          audioUrl={audioUrl}
          onSubmit={handleSubmit}
          onBack={handleReset}
        />
      )}

      {phase === "processing" && jobData && (
        <ProgressTracker
          status={jobData.status}
          message={jobData.message}
          progress={jobData.progress}
        />
      )}

      {phase === "results" && jobData && (
        <ScoreViewer
          jobId={jobId}
          regions={jobData.regions}
          filename={filename}
          onAddExtraction={handleAddExtraction}
          onReset={handleReset}
        />
      )}

      {phase === "error" && (
        <div>
          <div className="error-box">
            <span>⚠️</span>
            <div>
              <strong>Something went wrong</strong>
              <p style={{ marginTop: "0.3rem", fontSize: "0.85rem" }}>{error}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button className="btn btn-primary" onClick={handleAddExtraction}>
              Try again
            </button>
            <button className="btn btn-ghost" onClick={handleReset}>
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
