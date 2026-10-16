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
        <cdx-button @click="showImport = true">
          <cdx-icon :icon="cdxIconPaste" />
          {{ t("csv-import") }}
        </cdx-button>
        <cdx-button @click="copyTable">
          <cdx-icon :icon="cdxIconCopy" />
          {{ t("csv-copy") }}
        </cdx-button>
        <cdx-button @click="downloadCsv">
          <cdx-icon :icon="cdxIconDownload" />
          {{ t("csv-download") }}
        </cdx-button>
      </div>
      <p class="df-hint">{{ t("describe-keys") }}</p>

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
                    @paste="onPaste($event, row, field)"
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
                  @paste="onPaste($event, row, field)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <cdx-dialog
      v-model:open="showImport"
      :title="t('csv-import')"
      :use-close-button="true"
      :primary-action="{
        label: t('csv-apply'),
        actionType: 'progressive',
        disabled: !importText.trim(),
      }"
      @primary="onImport"
    >
      <p>{{ t("csv-import-help") }}</p>
      <p>
        <code>{{ ["file", ...FIELDS].join(", ") }}</code>
      </p>
      <cdx-text-area
        v-model="importText"
        class="df-import"
        :placeholder="exampleCsv"
        rows="10"
      />
    </cdx-dialog>

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
import { useClipboard, useObjectUrl } from "@vueuse/core";
import {
  CdxButton,
  CdxCheckbox,
  CdxCombobox,
  CdxDialog,
  CdxField,
  CdxIcon,
  CdxTextArea,
  CdxTextInput,
  CdxToggleSwitch,
} from "@wikimedia/codex";
import { useToast } from "@wikimedia/codex";
import {
  cdxIconArrowDown,
  cdxIconCopy,
  cdxIconDownload,
  cdxIconPaste,
} from "@wikimedia/codex-icons";
import { readTable, writeTable, type Table } from "../csv";
import { t } from "../i18n";
import { useAuth } from "../auth";
import { DEFAULT_FIELDS, FIELDS, LICENSES, type Field } from "../meta";
import { extension } from "../scan";
import { usePhotos, type Photo } from "../store";
import { ownWorkAuthor } from "../wikitext";
import PhotoThumb from "./PhotoThumb.vue";

const { directory, newPhotos, defaults, metaOf, applyTable } = usePhotos();
const toast = useToast();
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

const showImport = ref(false);
const importText = ref("");
const exampleCsv =
  "file,title,description,categories\nIMG_5612.JPG,Kraków - Market Square (01),Houses in Old Town Market Square,Old Town Market Square in Kraków";

function apply(table: Table, startRow = 0) {
  const { updated, unmatched, undo } = applyTable(table, startRow);
  let message = t("csv-applied", updated);
  if (unmatched) message += " " + t("csv-unmatched", unmatched);
  if (table.unknown.length)
    message += " " + t("csv-unknown", table.unknown.join(", "));
  toast[unmatched || table.unknown.length ? "warning" : "success"](message, {
    actionButton: { label: t("undo"), onClick: undo },
  });
}

function onImport() {
  apply(readTable(importText.value));
  showImport.value = false;
  importText.value = "";
}

/** Multiple cells from a spreadsheet fill the table from this cell on. */
function onPaste(event: ClipboardEvent, row: number, field: Field) {
  const text = event.clipboardData?.getData("text/plain") ?? "";
  if (!/[\t\n]/.test(text.trim())) return;
  event.preventDefault();
  apply(readTable(text, field), row);
}

const tableText = (delimiter: string) =>
  writeTable(
    newPhotos.value.map((photo) => ({ path: photo.path, meta: metaOf(photo) })),
    delimiter,
  );

const { copy } = useClipboard({ legacy: true });
async function copyTable() {
  // tab-separated: pastes into spreadsheet cells
  await copy(tableText("\t"));
  toast.success(t("csv-copied", newPhotos.value.length));
}

function downloadCsv() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([tableText(",")], { type: "text/csv" }),
  );
  a.download = `${directory.value?.name ?? "dinofoto"}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const preview = shallowRef<Photo>();
const previewUrl = useObjectUrl(computed(() => preview.value?.file));
</script>

<style scoped>
.df-defaults {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--size-1600), 1fr));
  gap: var(--spacing-100) var(--spacing-150);
  border: var(--border-width-base) solid var(--border-color-subtle);
  border-radius: var(--border-radius-base);
  margin: 0 0 var(--spacing-150);
  padding: var(--spacing-75) var(--spacing-150) var(--spacing-150);
}
.df-defaults legend {
  padding: 0 var(--spacing-50);
  font-weight: var(--font-weight-bold);
}
/* the grid gap separates the fields */
.df-defaults :deep(.cdx-field) {
  margin-top: 0;
}
.df-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-75);
  margin-bottom: var(--spacing-50);
}
.df-hint {
  margin: 0 0 var(--spacing-100);
  color: var(--color-subtle);
  font-size: var(--font-size-small);
}
.df-scroll {
  overflow: auto;
  max-height: calc(100vh - 10rem);
}
.df-th {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-25);
  white-space: nowrap;
}
.df-sheet th {
  padding: var(--spacing-25) var(--spacing-35);
}
.df-sheet td {
  padding: var(--spacing-35);
}
.df-sheet input {
  width: 100%;
  box-sizing: border-box;
  min-height: var(--size-200);
  padding: var(--spacing-25) var(--spacing-50);
  border: var(--border-width-base) solid var(--border-color-subtle);
  border-radius: var(--border-radius-base);
  background: var(--background-color-base);
  color: var(--color-base);
  font: inherit;
}
.df-sheet input:focus {
  outline: none;
  border-color: var(--border-color-progressive--focus);
  box-shadow: inset 0 0 0 var(--border-width-base)
    var(--box-shadow-color-progressive--focus);
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
  gap: var(--spacing-25);
}
.df-ext {
  color: var(--color-subtle);
}
.df-skipped td {
  opacity: 0.5;
}
.df-import :deep(textarea) {
  font-family: var(--font-family-monospace);
  font-size: var(--font-size-small);
  white-space: pre;
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
