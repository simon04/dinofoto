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
      <cdx-tab
        name="describe"
        :label="t('step-describe', newPhotos.length)"
        :disabled="!newPhotos.length"
      >
        <DescribeStep />
      </cdx-tab>
      <cdx-tab
        name="review"
        :label="t('step-review', items.length)"
        :disabled="!items.length"
      >
        <ReviewStep v-if="step === 'review'" />
      </cdx-tab>
      <cdx-tab
        name="upload"
        :label="t('step-upload', queue.length)"
        :disabled="!queue.length"
      >
        <UploadStep />
      </cdx-tab>
    </cdx-tabs>
    <div v-if="next" class="df-next">
      <cdx-button
        action="progressive"
        weight="primary"
        @click="step = next.name"
      >
        {{ next.label }}
        <cdx-icon :icon="cdxIconArrowNext" />
      </cdx-button>
    </div>
  </main>
  <cdx-toast-container />
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { useTextDirection } from "@vueuse/core";
import {
  CdxButton,
  CdxIcon,
  CdxTab,
  CdxTabs,
  CdxToastContainer,
} from "@wikimedia/codex";
import {
  cdxIconArrowNext,
  cdxIconLogoWikimediaCommons,
} from "@wikimedia/codex-icons";
import { isRTL, language, t } from "./i18n";
import LanguageSelector from "./components/LanguageSelector.vue";
import UserMenu from "./components/UserMenu.vue";
import FilesStep from "./components/FilesStep.vue";
import DescribeStep from "./components/DescribeStep.vue";
import ReviewStep from "./components/ReviewStep.vue";
import UploadStep from "./components/UploadStep.vue";
import { useUploader } from "./uploader";
import { usePhotos } from "./store";

const { newPhotos, items } = usePhotos();
const { queue } = useUploader();

/** The following step, once it has files. */
const next = computed(() => {
  const steps = [
    { name: "files", label: t("step-files"), enabled: true },
    {
      name: "describe",
      label: t("step-describe", newPhotos.value.length),
      enabled: newPhotos.value.length > 0,
    },
    {
      name: "review",
      label: t("step-review", items.value.length),
      enabled: items.value.length > 0,
    },
    {
      name: "upload",
      label: t("step-upload", queue.value.length),
      enabled: queue.value.length > 0,
    },
  ];
  const following = steps[steps.findIndex((s) => s.name === step.value) + 1];
  return following?.enabled ? following : undefined;
});

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
  border-bottom: var(--border-width-base) solid var(--border-color-subtle);
  padding: var(--spacing-50) var(--spacing-75);
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
/* spacing follows the Codex scale:
   https://doc.wikimedia.org/codex/latest/design-tokens/spacing.html */
.df-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-100);
  padding: var(--spacing-75) var(--spacing-150);
  border-bottom: var(--border-width-base) solid var(--border-color-subtle);
}
.df-logo {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-50);
  font-size: var(--font-size-x-large);
  font-weight: var(--font-weight-bold);
}
.df-intro {
  flex: 1;
  color: var(--color-subtle);
}
.df-main {
  max-width: none;
  padding: var(--spacing-150);
}
/* room between the tab list and the step content */
.df-main :deep(.cdx-tab) {
  padding-top: var(--spacing-150);
}
.df-next {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  padding: var(--spacing-75) 0;
  margin-top: var(--spacing-150);
  background: var(--background-color-base);
  border-top: var(--border-width-base) solid var(--border-color-subtle);
}
</style>
