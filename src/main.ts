import { createApp } from "vue";
import App from "./App.vue";
import { handleCallback } from "./auth";
import { lazyTooltip } from "./tooltip";

// the OAuth callback page only completes the login
const isCallback = await handleCallback().catch((e) => {
  console.error("Login failed", e);
  return false;
});
if (!isCallback)
  createApp(App)
    // Codex tooltips for icon-only buttons, also shown on keyboard focus
    .directive("tooltip", lazyTooltip)
    .mount("#app");
