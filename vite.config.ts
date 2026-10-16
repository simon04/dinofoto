import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";

// https://viteplus.dev/config/
export default defineConfig({
  // relative paths: served from GitHub Pages (/dinofoto/) and Toolforge (/)
  base: "./",
  plugins: [vue()],
  // the OAuth callback of the dev consumer is http://localhost:5173/oauth-callback
  server: { port: 5173, strictPort: true },
  fmt: {
    htmlWhitespaceSensitivity: "ignore",
    printWidth: 80,
  },
  lint: {
    ignorePatterns: ["dist/**"],
    options: {
      typeAware: true,
      typeCheck: false,
    },
  },
  test: {
    // browser APIs (sessionStorage, navigator, DOM) for the modules under test
    environment: "happy-dom",
  },
  staged: {
    "*": "vp check --fix",
  },
});
