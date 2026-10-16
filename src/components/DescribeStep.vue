<template>
  <section>
    <p v-if="!newPhotos.length" class="df-hint">{{ t("describe-empty") }}</p>
    <template v-else>
      <fieldset class="df-defaults">
        <legend>{{ t("defaults") }}</legend>
        <cdx-field>
          <template #label>{{ t("field-language") }}</template>
          <template #help-text>{{ t("field-language-help") }}</template>
          <cdx-text-input v-model="defaults.language" class="df-short" />
        </cdx-field>
        <cdx-field v-for="field in DEFAULT_FIELDS" :key="field">
          <template #label>{{ t(`field-${field}`) }}</template>
          <template #help-text>{{ t(`default-${field}-help`) }}</template>
          <cdx-combobox
            v-if="field === 'license'"
            v-model:selected="defaults.license"
            :menu-items="LICENSES.map((value) => ({ value }))"
          />
          <cdx-text-input
            v-else
            v-model="defaults[field]"
            :placeholder="field === 'author' ? ownWork : ''"
          />
        </cdx-field>
      </fieldset>

      <div class="df-toolbar">
        <span>{{ t("describe-selected", selected, newPhotos.length) }}</span>
        <cdx-toggle-switch v-model="moreColumns">
          {{ t("describe-more-columns") }}
        </cdx-toggle-switch>
        <span class="df-hint">{{ t("describe-keys") }}</span>
      </div>

      <div class="df-scroll">
        <table class="df-table df-sheet">
          <thead>
            <tr>
              <th>
                <cdx-checkbox
                  :model-value="selected === newPhotos.length"
                  :indeterminate="selected > 0 && selected < newPhotos.length"
                  :aria-label="t('describe-select-all')"
                  @update:model-value="selectAll"
                />
              </th>
              <th></th>
              <th v-for="field in columns" :key="field" :class="`df-${field}`">
                <span class="df-th">
                  {{ t(`field-${field}`) }}
                  <cdx-button
                    weight="quiet"
                    size="small"
                    :aria-label="t('describe-fill-down')"
                    v-tooltip="t('describe-fill-down')"
                    @click="fillDown(field)"
                  >
                    <cdx-icon :icon="cdxIconArrowDown" size="small" />
                  </cdx-button>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(photo, row) in newPhotos"
              :key="photo.path"
              :class="{ 'df-skipped': metaOf(photo).skip }"
            >
              <td>
                <cdx-checkbox
                  :model-value="!metaOf(photo).skip"
                  :aria-label="photo.path"
                  @update:model-value="metaOf(photo).skip = !$event"
                />
              </td>
              <td>
                <button
                  class="df-preview-button"
                  :title="photo.path"
                  @click="preview = photo"
                >
                  <PhotoThumb :file="photo.file" />
                </button>
              </td>
              <td v-for="field in columns" :key="field" :class="`df-${field}`">
                <span v-if="field === 'title'" class="df-title-cell">
                  <input
                    v-model="metaOf(photo).title"
                    :data-row="row"
                    :data-field="field"
                    :title="photo.path"
                    @keydown="onKeydown"
                  />
                  <span class="df-ext">.{{ extension(photo.path) }}</span>
                </span>
                <input
                  v-else
                  v-model="metaOf(photo)[field]"
                  :data-row="row"
                  :data-field="field"
                  :placeholder="placeholder(field)"
                  @keydown="onKeydown"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <cdx-dialog
      :open="!!preview"
      :title="preview?.path ?? ''"
      :use-close-button="true"
      class="df-preview-dialog"
      @update:open="preview = undefined"
    >
      <img v-if="previewUrl" :src="previewUrl" alt="" class="df-preview" />
    </cdx-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { useObjectUrl } from "@vueuse/core";
import {
  CdxButton,
  CdxCheckbox,
  CdxCombobox,
  CdxDialog,
  CdxField,
  CdxIcon,
  CdxTextInput,
  CdxToggleSwitch,
} from "@wikimedia/codex";
import { cdxIconArrowDown } from "@wikimedia/codex-icons";
import { t } from "../i18n";
import { useAuth } from "../auth";
import { DEFAULT_FIELDS, FIELDS, LICENSES, type Field } from "../meta";
import { extension } from "../scan";
import { usePhotos, type Photo } from "../store";
import { ownWorkAuthor } from "../wikitext";
import PhotoThumb from "./PhotoThumb.vue";

const { newPhotos, defaults, metaOf } = usePhotos();
const { username } = useAuth();

const moreColumns = ref(false);
const PER_FILE_DEFAULTS: Field[] = ["author", "source", "license"];
const columns = computed(() =>
  FIELDS.filter((f) => moreColumns.value || !PER_FILE_DEFAULTS.includes(f)),
);

const ownWork = computed(() => ownWorkAuthor(username.value));
function placeholder(field: Field): string {
  if (field === "author") return defaults.value.author || ownWork.value;
  if (field === "source" || field === "license") return defaults.value[field];
  return "";
}

const selected = computed(
  () => newPhotos.value.filter((photo) => !metaOf(photo).skip).length,
);
function selectAll(value: boolean) {
  for (const photo of newPhotos.value) metaOf(photo).skip = !value;
}

/** Fill empty cells with the value above, like a spreadsheet. */
function fillDown(field: Field) {
  let last = "";
  for (const photo of newPhotos.value) {
    const m = metaOf(photo);
    if (m[field]) last = m[field];
    else m[field] = last;
  }
}

/** Enter moves to the next row, Shift+Enter to the previous one. */
function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter") return;
  const input = event.target as HTMLInputElement;
  const row = Number(input.dataset.row) + (event.shiftKey ? -1 : 1);
  const next = document.querySelector<HTMLInputElement>(
    `.df-sheet input[data-row="${row}"][data-field="${input.dataset.field}"]`,
  );
  if (!next) return;
  event.preventDefault();
  next.focus();
  next.select();
}

const preview = shallowRef<Photo>();
const previewUrl = useObjectUrl(computed(() => preview.value?.file));
</script>

<style scoped>
.df-defaults {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 0 1rem;
  border: 1px solid var(--border-color-subtle);
  border-radius: var(--border-radius-base);
  margin: 0 0 1rem;
  padding: 0.5rem 1rem 1rem;
}
.df-defaults legend {
  font-weight: bold;
}
.df-defaults :deep(.cdx-field) {
  margin-top: 0.5rem;
}
.df-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}
.df-hint {
  color: var(--color-subtle);
}
.df-scroll {
  overflow: auto;
  max-height: calc(100vh - 10rem);
}
.df-th {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
}
.df-sheet td {
  padding: 0.125rem 0.25rem;
}
.df-sheet input {
  width: 100%;
  box-sizing: border-box;
  min-height: 2rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border-color-subtle);
  border-radius: var(--border-radius-base);
  background: var(--background-color-base);
  color: var(--color-base);
  font: inherit;
}
.df-sheet input:focus {
  outline: none;
  border-color: var(--border-color-progressive--focus);
  box-shadow: inset 0 0 0 1px var(--box-shadow-color-progressive--focus);
}
.df-sheet input::placeholder {
  color: var(--color-placeholder);
}
.df-title,
.df-description {
  min-width: 18rem;
}
.df-date {
  min-width: 11rem;
}
.df-categories,
.df-author,
.df-source,
.df-license {
  min-width: 14rem;
}
.df-latitude,
.df-longitude {
  min-width: 7rem;
}
.df-heading {
  min-width: 5rem;
}
.df-title-cell {
  display: flex;
  align-items: center;
  gap: 0.125rem;
}
.df-ext {
  color: var(--color-subtle);
}
.df-skipped td {
  opacity: 0.5;
}
.df-preview-button {
  padding: 0;
  border: 0;
  background: none;
  cursor: zoom-in;
}
.df-preview {
  max-width: 100%;
  max-height: 75vh;
  display: block;
  margin: auto;
}
.df-preview-dialog {
  max-width: 90vw;
  width: auto;
}
</style>
