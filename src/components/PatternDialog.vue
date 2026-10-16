<template>
  <cdx-dialog
    v-model:open="open"
    :title="t('pattern-title')"
    :use-close-button="true"
    :primary-action="{
      label: t('pattern-apply', rows.length),
      actionType: 'progressive',
      disabled: !pattern.trim() || !rows.length,
    }"
    @primary="apply"
  >
    <cdx-field>
      <template #label>{{ t("pattern") }}</template>
      <template #help-text>{{ t("pattern-help") }}</template>
      <cdx-text-input
        v-model="pattern"
        placeholder="Kraków – Market Square ({nn})"
      />
    </cdx-field>
    <div class="df-placeholders">
      <cdx-button
        v-for="placeholder in PLACEHOLDERS"
        :key="placeholder"
        size="small"
        @click="pattern += placeholder"
      >
        {{ placeholder }}
      </cdx-button>
    </div>
    <cdx-field>
      <template #label>{{ t("pattern-start") }}</template>
      <cdx-text-input v-model.number="start" input-type="number" min="0" />
    </cdx-field>

    <table v-if="pattern.trim()" class="df-table df-pattern-preview">
      <caption>
        {{ t("pattern-preview") }}
      </caption>
      <tr v-for="row in preview" :key="row.path">
        <td>{{ row.before }}</td>
        <td>→</td>
        <td>
          <strong>{{ row.after }}</strong>
        </td>
      </tr>
    </table>
  </cdx-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useLocalStorage } from "@vueuse/core";
import {
  CdxButton,
  CdxDialog,
  CdxField,
  CdxTextInput,
  useToast,
} from "@wikimedia/codex";
import { t } from "../i18n";
import { applyPattern, PLACEHOLDERS } from "../pattern";
import { usePhotos } from "../store";

const open = defineModel<boolean>("open", { required: true });

const { directory, newPhotos, metaOf } = usePhotos();
const toast = useToast();
const pattern = useLocalStorage("dinofoto.pattern", "");
const start = ref(1);

/** selected files, in table order */
const rows = computed(() =>
  newPhotos.value.filter((photo) => !metaOf(photo).skip),
);
const titleOf = (index: number) => {
  const photo = rows.value[index]!;
  return applyPattern(
    pattern.value,
    (Number(start.value) || 0) + index,
    metaOf(photo),
    // {folder} of files at the top is the opened directory
    `${directory.value?.name ?? ""}/${photo.path}`,
  );
};
const preview = computed(() =>
  rows.value.slice(0, 5).map((photo, i) => ({
    path: photo.path,
    before: metaOf(photo).title,
    after: titleOf(i),
  })),
);

function apply() {
  const titles = rows.value.map((photo, i) => [photo, titleOf(i)] as const);
  const before = titles.map(([photo]) => [photo, metaOf(photo).title] as const);
  for (const [photo, title] of titles) metaOf(photo).title = title;
  open.value = false;
  toast.success(t("pattern-applied", titles.length), {
    actionButton: {
      label: t("undo"),
      onClick: () => {
        for (const [photo, title] of before) metaOf(photo).title = title;
      },
    },
  });
}
</script>

<style scoped>
.df-placeholders {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-25);
  margin-top: var(--spacing-50);
}
.df-pattern-preview {
  width: 100%;
  margin-top: var(--spacing-150);
}
.df-pattern-preview caption {
  text-align: start;
  font-weight: var(--font-weight-bold);
  padding-bottom: var(--spacing-50);
}
</style>
