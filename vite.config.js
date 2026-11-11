import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  server: { port: 8080 },
  preview: { port: 8080 },
  // The WebGL scene (Three.js) is one lazy-loaded chunk of about 620 kB.
  build: { chunkSizeWarningLimit: 700 },
});
