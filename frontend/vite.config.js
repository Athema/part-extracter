import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/upload": "http://localhost:8000",
      "/process": "http://localhost:8000",
      "/status": "http://localhost:8000",
      "/score": "http://localhost:8000",
      "/audio": "http://localhost:8000",
    },
  },
});
