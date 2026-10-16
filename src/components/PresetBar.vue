<template>
  <div class="df-presets">
    <cdx-select
      v-model:selected="selected"
      :menu-items="names.map((value) => ({ value }))"
      :default-label="t('preset-choose')"
      :disabled="!names.length"
      @update:selected="load"
    />
    <cdx-button @click="showSave = true">
      <cdx-icon :icon="cdxIconBookmark" />
      {{ t("preset-save") }}
    </cdx-button>
    <cdx-button
      v-if="selected"
      weight="quiet"
      action="destructive"
      :aria-label="t('preset-delete')"
      v-tooltip="t('preset-delete')"
      @click="remove"
    >
      <cdx-icon :icon="cdxIconTrash" />
    </cdx-button>

    <cdx-dialog
      v-model:open="showSave"
      :title="t('preset-save')"
      :use-close-button="true"
      :primary-action="{
        label: t('preset-save'),
        actionType: 'progressive',
        disabled: !name.trim(),
      }"
      @primary="save"
    >
      <cdx-field>
        <template #label>{{ t("preset-name") }}</template>
        <template #help-text>{{ t("preset-help") }}</template>
        <cdx-text-input v-model="name" :placeholder="t('preset-example')" />
      </cdx-field>
    </cdx-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useLocalStorage } from "@vueuse/core";
import {
  CdxButton,
  CdxDialog,
  CdxField,
  CdxIcon,
  CdxSelect,
  CdxTextInput,
  useToast,
} from "@wikimedia/codex";
import { cdxIconBookmark, cdxIconTrash } from "@wikimedia/codex-icons";
import { t } from "../i18n";
import type { Defaults } from "../meta";
import { usePhotos } from "../store";

const { defaults } = usePhotos();
const toast = useToast();
/** named sets of defaults, e.g. per project */
const presets = useLocalStorage<Record<string, Defaults>>(
  "dinofoto.presets",
  {},
);
const names = computed(() =>
  Object.keys(presets.value).sort((a, b) => a.localeCompare(b)),
);
const selected = ref<string | null>(null);
const showSave = ref(false);
const name = ref("");

function load(preset: string | null) {
  if (!preset || !presets.value[preset]) return;
  defaults.value = { ...defaults.value, ...presets.value[preset] };
  toast.success(t("preset-loaded", preset));
}

function save() {
  const key = name.value.trim();
  presets.value = { ...presets.value, [key]: { ...defaults.value } };
  selected.value = key;
  showSave.value = false;
  toast.success(t("preset-saved", key));
}

function remove() {
  const key = selected.value!;
  const { [key]: removed, ...rest } = presets.value;
  presets.value = rest;
  selected.value = null;
  toast.success(t("preset-deleted", key), {
    actionButton: {
      label: t("undo"),
      onClick: () => {
        presets.value = { ...presets.value, [key]: removed! };
      },
    },
  });
}
</script>

<style scoped>
.df-presets {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-75);
}
</style>
