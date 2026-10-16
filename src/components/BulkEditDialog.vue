<template>
  <cdx-dialog
    v-model:open="open"
    :title="t('bulk-title')"
    :use-close-button="true"
    :primary-action="{
      label: t('bulk-apply', rows.length),
      actionType: 'progressive',
      disabled: !rows.length || (mode !== 'replace' && !value.trim()),
    }"
    @primary="apply"
  >
    <p>{{ t("bulk-help") }}</p>
    <cdx-field>
      <template #label>{{ t("bulk-field") }}</template>
      <cdx-select v-model:selected="field" :menu-items="fields" />
    </cdx-field>
    <cdx-field>
      <template #label>{{ t(`field-${field}`) }}</template>
      <cdx-text-input
        v-model="value"
        :list="
          field === 'categories'
            ? 'df-category-list'
            : field === 'depicts'
              ? 'df-item-list'
              : undefined
        "
        autocomplete="off"
        @input="$emit('suggest', field, value)"
      />
    </cdx-field>
    <cdx-field :is-fieldset="true">
      <template #label>{{ t("bulk-mode") }}</template>
      <cdx-radio
        v-for="m in MODES"
        :key="m"
        v-model="mode"
        name="bulk-mode"
        :input-value="m"
      >
        {{ t(`bulk-mode-${m}`) }}
      </cdx-radio>
    </cdx-field>
  </cdx-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  CdxDialog,
  CdxField,
  CdxRadio,
  CdxSelect,
  CdxTextInput,
  useToast,
} from "@wikimedia/codex";
import { t } from "../i18n";
import { FIELDS, type Field } from "../meta";
import { usePhotos } from "../store";

const open = defineModel<boolean>("open", { required: true });
defineEmits<{ suggest: [field: Field, value: string] }>();

const MODES = ["replace", "append", "empty"] as const;
/** lists: appended entries are separated by `;` */
const LISTS: Field[] = ["categories", "depicts"];

const { newPhotos, metaOf } = usePhotos();
const toast = useToast();

// titles have their own dialog (pattern)
const fields = FIELDS.filter((f) => f !== "title").map((f) => ({
  value: f,
  label: t(`field-${f}`),
}));
const field = ref<Field>("categories");
const value = ref("");
const mode = ref<(typeof MODES)[number]>("append");

const rows = computed(() =>
  newPhotos.value.filter((photo) => !metaOf(photo).skip),
);

/** New cell value: replaced, appended, or only set where empty. */
function update(current: string): string {
  const v = value.value.trim();
  if (mode.value === "replace") return v;
  if (mode.value === "empty") return current.trim() ? current : v;
  if (!current.trim()) return v;
  return LISTS.includes(field.value)
    ? `${current.trim().replace(/;$/, "")}; ${v}`
    : `${current.trimEnd()} ${v}`;
}

function apply() {
  const f = field.value;
  const before = rows.value.map((photo) => [photo, metaOf(photo)[f]] as const);
  let count = 0;
  for (const photo of rows.value) {
    const m = metaOf(photo);
    const next = update(m[f]);
    if (next !== m[f]) {
      m[f] = next;
      count++;
    }
  }
  open.value = false;
  toast.success(t("csv-applied", count), {
    actionButton: {
      label: t("undo"),
      onClick: () => {
        for (const [photo, old] of before) metaOf(photo)[f] = old;
      },
    },
  });
}
</script>
