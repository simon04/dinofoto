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

    <cdx-message v-if="target.id !== 'commons'" type="warning">
      {{ t("upload-test-notice", target.host) }}
    </cdx-message>

    <div class="df-toolbar">
      <cdx-field>
        <template #label>{{ t("upload-target") }}</template>
        <cdx-select
          v-model:selected="targetId"
          :menu-items="targets"
          :disabled="busy"
        />
      </cdx-field>
      <cdx-field class="df-comment">
        <template #label>{{ t("upload-comment") }}</template>
        <cdx-text-input v-model="comment" :disabled="running" />
      </cdx-field>
      <cdx-button
        v-if="!running && unchecked"
        size="large"
        :disabled="!username || busy"
        @click="withWakeLock(check)"
      >
        <cdx-icon :icon="cdxIconCheck" />
        {{ t("upload-check", unchecked) }}
      </cdx-button>
      <cdx-button
        v-if="!running"
        action="progressive"
        weight="primary"
        size="large"
        :disabled="!username || remaining === 0 || busy"
        @click="withWakeLock(start)"
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

    <div v-if="summary.done" class="df-results">
      <a
        :href="`https://${target.host}/wiki/Special:ListFiles/${encodeURIComponent(username ?? '')}`"
        target="_blank"
        rel="external noopener"
      >
        {{ t("upload-your-files") }}
      </a>
      <cdx-button size="small" @click="copyGallery">
        <cdx-icon :icon="cdxIconImageGallery" size="small" />
        {{ t("upload-copy-gallery") }}
      </cdx-button>
      <cdx-button
        v-if="qsLines.length"
        size="small"
        @click="copyQuickStatements"
      >
        <cdx-icon :icon="cdxIconCopy" size="small" />
        {{ t("upload-copy-qs") }}
      </cdx-button>
    </div>

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
              :href="fileUrl(item.title, target)"
              target="_blank"
              rel="external noopener"
            >
              File:{{ item.title }}
            </a>
            <template v-else>File:{{ item.title }}</template>
            <div class="df-path">
              {{ item.photo.path }}
              <a
                v-if="stateOf(item).mid"
                :href="`https://${target.host}/wiki/Special:EntityPage/${stateOf(item).mid}`"
                target="_blank"
                rel="external noopener"
              >
                <code>{{ stateOf(item).mid }}</code>
              </a>
            </div>
          </td>
          <td class="df-num">{{ formatSize(item.photo.file.size) }}</td>
          <td>
            <cdx-info-chip :status="chipStatus[stateOf(item).state]">
              {{ t(`upload-state-${stateOf(item).state}`) }}
              <template
                v-if="
                  stateOf(item).state === 'uploading' && stateOf(item).bytes
                "
              >
                {{
                  Math.floor(
                    (100 * stateOf(item).bytes!) / item.photo.file.size,
                  )
                }}
                %
              </template>
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
import { useClipboard, useEventListener, useWakeLock } from "@vueuse/core";
import {
  CdxButton,
  CdxField,
  CdxIcon,
  CdxInfoChip,
  CdxMessage,
  CdxSelect,
  CdxTextInput,
  useToast,
} from "@wikimedia/codex";
import {
  cdxIconCheck,
  cdxIconCopy,
  cdxIconImageGallery,
  cdxIconLogIn,
  cdxIconPause,
  cdxIconUpload,
} from "@wikimedia/codex-icons";
import { t } from "../i18n";
import { loginAvailable, useAuth } from "../auth";
import { fileUrl, target, WIKIS } from "../wiki";
import { formatSize } from "../format";
import { useUploader, type UploadState } from "../uploader";
import PhotoThumb from "./PhotoThumb.vue";
import { parseCaptions } from "../meta";
import { quickStatements, statements } from "../sdc";
import { usePhotos } from "../store";

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
  check,
  pause,
  uploadItem,
} = useUploader();
const toast = useToast();

const targets = WIKIS.map((wiki) => ({
  value: wiki.id,
  label: t(`wiki-${wiki.id}` as "wiki-commons"),
  description: wiki.host,
}));
const targetId = computed({
  get: () => target.value.id,
  set: (id: string) => {
    target.value = WIKIS.find((wiki) => wiki.id === id)!;
  },
});

const { defaults } = usePhotos();
const done = computed(() =>
  queue.value.filter((item) => stateOf(item).state === "done"),
);
const { copy } = useClipboard({ legacy: true });

/** `<gallery>` of the uploaded files, with their captions. */
async function copyGallery() {
  const lines = done.value.map((item) => {
    const caption = Object.values(
      parseCaptions(item.meta.caption, defaults.value.language),
    )[0];
    const title = stateOf(item).filename ?? item.title;
    return caption ? `File:${title}|${caption}` : `File:${title}`;
  });
  await copy(`<gallery>\n${lines.join("\n")}\n</gallery>\n`);
  toast.success(t("upload-copied", lines.length));
}

/** structured data of the uploaded files with a known MediaInfo ID */
const qsLines = computed(() =>
  target.value.wikidata
    ? done.value.flatMap((item) => {
        const { mid } = stateOf(item);
        if (!mid) return [];
        return quickStatements(
          mid,
          parseCaptions(item.meta.caption, defaults.value.language),
          statements(item.meta, defaults.value, username.value),
        );
      })
    : [],
);
async function copyQuickStatements() {
  await copy(qsLines.value.join("\n") + "\n");
  toast.success(t("upload-copied-qs"));
}

const count = (states: UploadState["state"][]) =>
  queue.value.filter((item) => states.includes(stateOf(item).state)).length;
const remaining = computed(() => count(["waiting", "failed", "checked"]));
const unchecked = computed(() => count(["waiting", "failed"]));

const chipStatus = {
  waiting: "notice",
  checking: "notice",
  checked: "notice",
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
async function withWakeLock(run: () => Promise<void>) {
  await wakeLock.request("screen").catch(() => undefined);
  try {
    await run();
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
.df-toolbar :deep(.cdx-field) {
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
.df-results {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-75);
  margin-bottom: var(--spacing-100);
}
.df-path code {
  margin-inline-start: var(--spacing-50);
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
