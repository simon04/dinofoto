<template>
  <div class="vector-header-container">
    <div class="vector-header mw-header df-header">
      <a class="df-logo" href="./">
        <cdx-icon :icon="cdxIconLogoWikimediaCommons" />
        DinoFoto
      </a>
      <span class="df-intro">{{ t("app-intro") }}</span>
      <LanguageSelector v-model="language" />
      <UserMenu />
    </div>
  </div>

  <main class="mw-page-container df-main">
    <cdx-tabs v-model:active="step" :framed="true">
      <cdx-tab name="files" :label="t('step-files')">
        <FilesStep />
      </cdx-tab>
    </cdx-tabs>
  </main>
  <cdx-toast-container />
</template>

<script setup lang="ts">
import { ref, watchEffect } from "vue";
import { useTextDirection } from "@vueuse/core";
import { CdxIcon, CdxTab, CdxTabs, CdxToastContainer } from "@wikimedia/codex";
import { cdxIconLogoWikimediaCommons } from "@wikimedia/codex-icons";
import { isRTL, language, t } from "./i18n";
import LanguageSelector from "./components/LanguageSelector.vue";
import UserMenu from "./components/UserMenu.vue";
import FilesStep from "./components/FilesStep.vue";

const step = ref("files");

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

.df-table {
  border-collapse: collapse;
}
.df-table th,
.df-table td {
  border-bottom: 1px solid var(--border-color-subtle);
  padding: 0.25rem 0.5rem;
  text-align: start;
  vertical-align: middle;
}
.df-table th {
  background: var(--background-color-neutral-subtle);
  position: sticky;
  top: 0;
  z-index: 1;
}
.df-num {
  text-align: end !important;
  white-space: nowrap;
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
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
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
