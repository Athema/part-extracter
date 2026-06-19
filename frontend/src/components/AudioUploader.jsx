import { useRef, useState } from "react";

const ACCEPTED = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/flac", "audio/aac", "audio/mp4"];

export default function AudioUploader({ onUploaded }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  async function handleFile(file) {
    if (!file) return;
    if (ACCEPTED.length && !ACCEPTED.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|flac|aac|m4a)$/i)) {
      setError("Please upload an audio file (MP3, WAV, FLAC, etc.)");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
      const data = await res.json();
      onUploaded(data.file_id, file.name);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  if (uploading) {
    return (
      <div className="uploading-box">
        <div className="spinner" />
        <p>Uploading audio…</p>
      </div>
    );
  }

  return (
    <div>
      <div
        className={`upload-zone ${dragOver ? "drag-over" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0]);
        }}
      >
        <span className="icon">🎵</span>
        <h2>Drop your audio file here</h2>
        <p>or click to browse — MP3, WAV, FLAC, AAC supported</p>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>
      {error && (
        <div className="error-box mt-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
