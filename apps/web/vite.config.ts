/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// M0 part 5 spec, P5.2–P5.3; the /api proxy is part 7's (P7.2).
// Where the Django API listens; Compose sets this to its api service (part 8).
const apiOrigin = process.env.CODE_WEB_API_ORIGIN ?? "http://127.0.0.1:8000";
const proxy = { "/api": { target: apiOrigin } };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
