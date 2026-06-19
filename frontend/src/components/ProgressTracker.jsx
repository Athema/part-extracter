export default function ProgressTracker({ status, message, progress }) {
  return (
    <div className="progress-box">
      <div className="spinner" style={{ marginBottom: "1.5rem" }} />
      <h2>Processing your audio…</h2>
      <p className="message">{message}</p>
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="progress-pct">{progress}%</p>
    </div>
  );
}
