import { useCallback, useEffect, useRef, useState } from "react";
import AudioUploader from "./components/AudioUploader";
import InstrumentSelector from "./components/InstrumentSelector";
import ProgressTracker from "./components/ProgressTracker";
import ScoreViewer from "./components/ScoreViewer";

const POLL_INTERVAL = 2500;

export default function App() {
  const [phase, setPhase] = useState("upload"); // upload | selecting | processing | results | error
  const [fileId, setFileId] = useState(null);
  const [filename, setFilename] = useState("");
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
    setPhase("selecting");
  }, []);

  const handleSubmit = useCallback(async (stems) => {
    setPhase("processing");
    setJobData({ status: "queued", progress: 0, message: "Starting…", scores: {} });
    try {
      const res = await fetch("/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId, stems }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.statusText}`);
      const { job_id } = await res.json();
      setJobId(job_id);
    } catch (err) {
      setError(err.message);
      setPhase("error");
    }
  }, [fileId]);

  // Allow extracting more parts from the same song without re-uploading
  const handleAddExtraction = useCallback(() => {
    setJobId(null);
    setJobData(null);
    setPhase("selecting");
  }, []);

  const handleReset = useCallback(() => {
    setFileId(null);
    setFilename("");
    setJobId(null);
    setJobData(null);
    setError(null);
    setPhase("upload");
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>🎼 Part Extracter</h1>
        <p>Upload a song — get a score for any instrument, just the parts where it plays</p>
      </header>

      {phase === "upload" && <AudioUploader onUploaded={handleUploaded} />}

      {phase === "selecting" && (
        <InstrumentSelector
          filename={filename}
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
          scores={jobData.scores}
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
