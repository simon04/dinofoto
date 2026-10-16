<template>
  <section>
    <div class="df-toolbar" aria-live="polite">
      <cdx-info-chip status="success">
        {{ t("review-ready", ready) }}
      </cdx-info-chip>
      <cdx-info-chip v-if="invalid" status="error">
        {{ t("review-invalid", invalid) }}
      </cdx-info-chip>
      <cdx-info-chip v-if="warned" status="warning">
        {{ t("review-warned", warned) }}
      </cdx-info-chip>
      <cdx-button :disabled="checkingTitles" @click="checkTitles">
        <cdx-icon :icon="cdxIconReload" />
        {{ checkingTitles ? t("review-checking") : t("review-check") }}
      </cdx-button>
      <cdx-toggle-switch v-model="rendered">
        {{ t("review-rendered") }}
      </cdx-toggle-switch>
    </div>

    <div class="df-review">
      <ul class="df-list" role="listbox" :aria-label="t('step-review', 0)">
        <li
          v-for="item in items"
          :key="item.photo.path"
          role="option"
          :aria-selected="item === current"
          :class="{ 'df-current': item === current }"
          @click="selected = item.photo.path"
        >
          <cdx-icon
            :icon="
              item.invalid
                ? cdxIconError
                : item.problems.length
                  ? cdxIconAlert
                  : cdxIconCheck
            "
            :class="
              item.invalid
                ? 'df-error'
                : item.problems.length
                  ? 'df-warning'
                  : 'df-ok'
            "
            size="small"
          />
          {{ item.title }}
        </li>
      </ul>

      <article v-if="current" class="df-detail">
        <h3>
          <PhotoThumb :key="current.photo.path" :file="current.photo.file" />
          <span>
            File:{{ current.title }}
            <small>{{ current.photo.path }}</small>
          </span>
        </h3>
        <cdx-message
          v-for="problem in current.problems"
          :key="problem"
          :type="ERRORS.has(problem) ? 'error' : 'warning'"
          :inline="true"
        >
          {{ t(`problem-${problem}`, current.unknownCategories.join(", ")) }}
        </cdx-message>
        <!-- eslint-disable-next-line vue/no-v-html -- rendered by MediaWiki -->
        <div v-if="rendered" class="df-rendered" v-html="html" />
        <pre v-else class="df-wikitext">{{ current.text }}</pre>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { computedAsync, refDebounced } from "@vueuse/core";
import {
  CdxButton,
  CdxIcon,
  CdxInfoChip,
  CdxMessage,
  CdxToggleSwitch,
} from "@wikimedia/codex";
import {
  cdxIconAlert,
  cdxIconCheck,
  cdxIconError,
  cdxIconReload,
} from "@wikimedia/codex-icons";
import { t } from "../i18n";
import { parse } from "../commons";
import { usePhotos } from "../store";
import { ERRORS } from "../wikitext";
import PhotoThumb from "./PhotoThumb.vue";

const { items, checkTitles, checkingTitles } = usePhotos();

// shown when the step is opened: catches names taken meanwhile
onMounted(checkTitles);

const selected = ref<string>();
const current = computed(
  () =>
    items.value.find((item) => item.photo.path === selected.value) ??
    items.value[0],
);

const invalid = computed(() => items.value.filter((i) => i.invalid).length);
const warned = computed(
  () => items.value.filter((i) => !i.invalid && i.problems.length).length,
);
const ready = computed(() => items.value.length - invalid.value);

const rendered = ref(false);
const debounced = refDebounced(current, 300);
const html = computedAsync(
  async () => {
    const item = debounced.value;
    if (!rendered.value || !item) return "";
    return await parse(item.text, item.title);
  },
  "",
  { onError: console.warn },
);
</script>

<style scoped>
.df-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-75);
  margin-bottom: var(--spacing-150);
}
.df-review {
  display: grid;
  grid-template-columns: minmax(14rem, 1fr) 3fr;
  gap: var(--spacing-150);
  align-items: start;
}
.df-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: calc(100vh - 12rem);
  overflow: auto;
  border: var(--border-width-base) solid var(--border-color-subtle);
  border-radius: var(--border-radius-base);
}
.df-list li {
  display: flex;
  align-items: center;
  gap: var(--spacing-50);
  margin: 0;
  padding: var(--spacing-50) var(--spacing-75);
  cursor: pointer;
  overflow-wrap: anywhere;
}
.df-list li:hover {
  background: var(--background-color-interactive-subtle--hover);
}
.df-list li.df-current {
  background: var(--background-color-progressive-subtle);
  color: var(--color-progressive);
}
.df-error {
  color: var(--color-icon-error);
}
.df-warning {
  color: var(--color-icon-warning);
}
.df-ok {
  color: var(--color-icon-success);
}
.df-detail h3 {
  display: flex;
  align-items: center;
  gap: var(--spacing-75);
  margin: 0 0 var(--spacing-100);
  overflow-wrap: anywhere;
}
.df-detail h3 small {
  display: block;
  font-weight: normal;
  color: var(--color-subtle);
}
.df-detail .cdx-message + .cdx-message {
  margin-top: var(--spacing-50);
}
.df-wikitext,
.df-rendered {
  margin: var(--spacing-150) 0 0;
  padding: var(--spacing-100) var(--spacing-150);
  border: var(--border-width-base) solid var(--border-color-subtle);
  border-radius: var(--border-radius-base);
  background: var(--background-color-neutral-subtle);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.df-rendered {
  white-space: normal;
  background: var(--background-color-base);
}
</style>
