<template>
  <cdx-info-chip :status="chipStatus">
    <a
      v-if="photo.status === 'exists' && photo.existing"
      :href="fileUrl(photo.existing)"
      target="_blank"
      rel="external noopener"
    >
      {{ t("status-exists") }}
    </a>
    <span v-else :title="photo.error ?? photo.existing">
      {{ t(`status-${photo.status}`) }}
    </span>
  </cdx-info-chip>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { CdxInfoChip } from "@wikimedia/codex";
import { t } from "../i18n";
import { fileUrl } from "../commons";
import type { Photo } from "../store";

const props = defineProps<{ photo: Photo }>();

const chipStatus = computed(
  () =>
    (
      {
        new: "success",
        duplicate: "warning",
        error: "error",
      } as const
    )[props.photo.status as string] ?? "notice",
);
</script>
