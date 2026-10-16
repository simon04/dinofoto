<template>
  <section>
    <cdx-message v-if="!loginAvailable" type="warning">
      {{ t("upload-unavailable") }}
      <a href="https://dinofoto.toolforge.org/">dinofoto.toolforge.org</a>
    </cdx-message>
    <cdx-message v-else-if="!username" type="notice">
      {{ t("upload-login") }}
      <cdx-button action="progressive" @click="onLogin">
        <cdx-icon :icon="cdxIconLogIn" />
        {{ t("login") }}
      </cdx-button>
    </cdx-message>

    <div class="df-toolbar">
      <cdx-field class="df-comment">
        <template #label>{{ t("upload-comment") }}</template>
        <cdx-text-input v-model="comment" :disabled="running" />
      </cdx-field>
      <cdx-button
        v-if="!running"
        action="progressive"
        weight="primary"
        size="large"
        :disabled="!username || remaining === 0 || busy"
        @click="startUpload"
      >
        <cdx-icon :icon="cdxIconUpload" />
        {{ t("upload-start", remaining) }}
      </cdx-button>
      <cdx-button v-else size="large" :disabled="pausing" @click="pause">
        <cdx-icon :icon="cdxIconPause" />
        {{ pausing ? t("upload-pausing") : t("upload-pause") }}
      </cdx-button>
    </div>

    <div class="df-summary" aria-live="polite">
      <strong>
        {{ t("upload-progress", summary.done, queue.length) }}
        ({{ formatSize(summary.bytes) }} / {{ formatSize(summary.total) }})
      </strong>
      <cdx-info-chip v-if="summary.warning" status="warning">
        {{ t("upload-warnings", summary.warning) }}
      </cdx-info-chip>
      <cdx-info-chip v-if="summary.failed" status="error">
        {{ t("upload-failed", summary.failed) }}
      </cdx-info-chip>
    </div>
    <progress
      class="df-progress"
      :max="summary.total || 1"
      :value="summary.bytes"
    />

    <table class="df-table df-uploads">
      <tbody>
        <tr
          v-for="item in queue"
          :key="item.photo.path"
          :class="`df-${stateOf(item).state}`"
        >
          <td><PhotoThumb :file="item.photo.file" /></td>
          <td class="df-name">
            <a
              v-if="stateOf(item).state === 'done'"
              :href="fileUrl(item.title)"
              target="_blank"
              rel="external noopener"
            >
              File:{{ item.title }}
            </a>
            <template v-else>File:{{ item.title }}</template>
            <div class="df-path">{{ item.photo.path }}</div>
          </td>
          <td class="df-num">{{ formatSize(item.photo.file.size) }}</td>
          <td>
            <cdx-info-chip :status="chipStatus[stateOf(item).state]">
              {{ t(`upload-state-${stateOf(item).state}`) }}
            </cdx-info-chip>
          </td>
          <td class="df-message">
            {{ stateOf(item).message }}
            <cdx-button
              v-if="stateOf(item).state === 'warning' && !busy"
              size="small"
              @click="uploadItem(item, true)"
            >
              {{ t("upload-ignore-warnings") }}
            </cdx-button>
            <cdx-button
              v-if="stateOf(item).state === 'failed' && !busy"
              size="small"
              @click="uploadItem(item)"
            >
              {{ t("upload-retry") }}
            </cdx-button>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useEventListener, useWakeLock } from "@vueuse/core";
import {
  CdxButton,
  CdxField,
  CdxIcon,
  CdxInfoChip,
  CdxMessage,
  CdxTextInput,
  useToast,
} from "@wikimedia/codex";
import {
  cdxIconLogIn,
  cdxIconPause,
  cdxIconUpload,
} from "@wikimedia/codex-icons";
import { t } from "../i18n";
import { loginAvailable, useAuth } from "../auth";
import { fileUrl } from "../commons";
import { formatSize } from "../format";
import { useUploader, type UploadState } from "../uploader";
import PhotoThumb from "./PhotoThumb.vue";

const { username, login } = useAuth();
const {
  comment,
  queue,
  stateOf,
  running,
  busy,
  pausing,
  summary,
  start,
  pause,
  uploadItem,
} = useUploader();
const toast = useToast();

const remaining = computed(
  () =>
    queue.value.filter((item) =>
      ["waiting", "failed"].includes(stateOf(item).state),
    ).length,
);

const chipStatus = {
  waiting: "notice",
  uploading: "notice",
  done: "success",
  warning: "warning",
  failed: "error",
} as const satisfies Record<UploadState["state"], string>;

// keep the computer awake and warn before closing during a long batch
const wakeLock = useWakeLock();
useEventListener(window, "beforeunload", (event) => {
  if (running.value) event.preventDefault();
});
async function startUpload() {
  await wakeLock.request("screen").catch(() => undefined);
  try {
    await start();
  } finally {
    await wakeLock.release().catch(() => undefined);
  }
}

async function onLogin() {
  try {
    await login();
  } catch (e) {
    if (!String(e).includes("closed"))
      toast.error(t("login-failed", String(e)));
  }
}
</script>

<style scoped>
.cdx-message {
  margin-bottom: var(--spacing-150);
}
.cdx-message .cdx-button {
  margin-inline-start: var(--spacing-75);
}
.df-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--spacing-100);
  margin-bottom: var(--spacing-150);
}
.df-comment {
  flex: 1;
  max-width: var(--size-4000);
}
.df-comment :deep(.cdx-field__control) {
  margin: 0;
}
.df-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-50);
  margin-bottom: var(--spacing-75);
}
.df-progress {
  display: block;
  width: 100%;
  margin: 0 0 var(--spacing-150);
  accent-color: var(--background-color-progressive);
}
.df-uploads {
  width: 100%;
}
.df-name {
  min-width: var(--size-1600);
}
.df-path {
  margin-top: var(--spacing-25);
  color: var(--color-subtle);
  font-size: var(--font-size-small);
}
/* takes the remaining width, so the other columns stay compact */
.df-message {
  width: 100%;
  overflow-wrap: anywhere;
}
.df-message .cdx-button {
  margin-inline-start: var(--spacing-50);
}
.df-uploading {
  background: var(--background-color-progressive-subtle);
}
</style>
