<template>
  <section class="df-files">
    <cdx-message v-if="!supported" type="error">
      {{ t("files-unsupported") }}
    </cdx-message>
    <div class="df-toolbar">
      <cdx-button
        action="progressive"
        weight="primary"
        :disabled="!supported"
        @click="onOpen"
      >
        <cdx-icon :icon="cdxIconFolderPlaceholder" />
        {{ t("files-open") }}
      </cdx-button>
      <strong v-if="directory">{{ directory.name }}</strong>
      <cdx-toggle-switch v-if="photos.length" v-model="showAll">
        {{ t("files-show-all") }}
      </cdx-toggle-switch>
    </div>

    <p v-if="!directory" class="df-hint">{{ t("files-hint") }}</p>
    <template v-else>
      <div class="df-summary" aria-live="polite">
        <span v-if="scanning && !photos.length">{{ t("files-scanning") }}</span>
        <template v-else>
          <span>{{ t("files-found", photos.length) }}</span>
          <cdx-info-chip v-if="pending" status="notice">
            {{ t("files-checking", photos.length - pending, photos.length) }}
          </cdx-info-chip>
          <cdx-info-chip status="success">
            {{ t("status-new-count", counts.new) }}
          </cdx-info-chip>
          <cdx-info-chip v-if="counts.exists">
            {{ t("status-exists-count", counts.exists) }}
          </cdx-info-chip>
          <cdx-info-chip v-if="counts.duplicate" status="warning">
            {{ t("status-duplicate-count", counts.duplicate) }}
          </cdx-info-chip>
          <cdx-info-chip v-if="counts.error" status="error">
            {{ t("status-error-count", counts.error) }}
          </cdx-info-chip>
        </template>
      </div>
      <progress
        v-if="pending"
        class="df-progress"
        :max="photos.length"
        :value="photos.length - pending"
      />

      <table v-if="shown.length" class="df-table">
        <thead>
          <tr>
            <th></th>
            <th>{{ t("files-path") }}</th>
            <th>{{ t("files-size") }}</th>
            <th>{{ t("files-status") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="photo in shown" :key="photo.path">
            <td><PhotoThumb :file="photo.file" /></td>
            <td>{{ photo.path }}</td>
            <td class="df-num">{{ formatSize(photo.file.size) }}</td>
            <td>
              <StatusChip :photo="photo" />
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useToast } from "@wikimedia/codex";
import {
  CdxButton,
  CdxIcon,
  CdxInfoChip,
  CdxMessage,
  CdxToggleSwitch,
} from "@wikimedia/codex";
import { cdxIconFolderPlaceholder } from "@wikimedia/codex-icons";
import { t } from "../i18n";
import { formatSize } from "../format";
import { usePhotos } from "../store";
import PhotoThumb from "./PhotoThumb.vue";
import StatusChip from "./StatusChip.vue";

const supported = "showDirectoryPicker" in window;
const { directory, photos, scanning, counts, open } = usePhotos();
const toast = useToast();
const showAll = ref(false);

const pending = computed(() => counts.value.queued + counts.value.hashing);
const shown = computed(() =>
  showAll.value
    ? photos.value
    : photos.value.filter((photo) => photo.status !== "exists"),
);

async function onOpen() {
  try {
    await open();
  } catch (e) {
    // the user cancelled the picker
    if ((e as Error).name !== "AbortError") toast.error(String(e));
  }
}
</script>

<style scoped>
.df-toolbar,
.df-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.df-hint {
  color: var(--color-subtle);
  max-width: 40rem;
}
.df-progress {
  width: 100%;
  accent-color: var(--background-color-progressive);
}
</style>
