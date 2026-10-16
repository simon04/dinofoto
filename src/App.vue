<template>
  <div class="vector-header-container">
    <div class="vector-header mw-header df-header">
      <a class="df-logo" href="./">DinoFoto</a>
      <span class="df-intro">{{ t("app-intro") }}</span>
      <LanguageSelector v-model="language" />
      <UserMenu />
    </div>
  </div>

  <main class="mw-page-container df-main"></main>
  <cdx-toast-container />
</template>

<script setup lang="ts">
import { watchEffect } from "vue";
import { useTextDirection } from "@vueuse/core";
import { CdxToastContainer } from "@wikimedia/codex";
import { isRTL, language, t } from "./i18n";
import LanguageSelector from "./components/LanguageSelector.vue";
import UserMenu from "./components/UserMenu.vue";

const dir = useTextDirection();
watchEffect(() => {
  document.documentElement.lang = language.value;
  dir.value = isRTL() ? "rtl" : "ltr";
});
</script>

<style>
@import "@wikimedia/codex/dist/codex.style-bidi.css";
@import "@wikimedia/codex-design-tokens/theme-wikimedia-ui.css";
@import "@wikimedia/codex-design-tokens/theme-wikimedia-ui-mode-dark.css"
  (prefers-color-scheme: dark);

:root {
  color-scheme: light dark;
}
html,
body {
  background-color: var(--background-color-base);
  color: var(--color-base);
}
/* Codex typography https://doc.wikimedia.org/codex/latest/style-guide/typography.html */
html,
body,
h2,
h3,
input,
button,
textarea,
select {
  font-family: var(--font-family-system-sans);
}
code,
kbd,
pre,
samp,
textarea.df-mono {
  font-family: var(--font-family-monospace);
  font-size: var(--font-size-small);
}
</style>

<style scoped>
.df-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
}
.df-logo {
  font-size: 1.25rem;
  font-weight: bold;
}
.df-intro {
  flex: 1;
  color: var(--color-subtle);
}
.df-main {
  max-width: none;
  padding: 1rem;
}
</style>
