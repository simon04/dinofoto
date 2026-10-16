<template>
  <cdx-lookup
    v-model:selected="selected"
    v-model:input-value="inputValue"
    class="dd-language"
    :menu-items="menuItems"
    :menu-config="{ visibleItemLimit: 10 }"
    :start-icon="cdxIconLanguage"
    :aria-label="t('language')"
    @input="onInput"
    @focusin="onFocus"
    @focusout="inputValue = model"
    @update:selected="onSelected"
  >
    <template #no-results>{{ t("language-no-results") }}</template>
  </cdx-lookup>
</template>

<script setup lang="ts">
import { t } from "../i18n";
import { computed, ref, watch } from "vue";
import { useFetch } from "@vueuse/core";
import { CdxLookup, type MenuItemData } from "@wikimedia/codex";
import { cdxIconLanguage } from "@wikimedia/codex-icons";

const model = defineModel<string>({ required: true });

const selected = ref<string | null>(model.value);
const inputValue = ref(model.value);
const menuItems = ref<MenuItemData[]>([]);

watch(model, (value) => {
  selected.value = value;
  inputValue.value = value;
});

const { data } = useFetch(
  "https://www.wikidata.org/w/api.php?action=query&meta=languageinfo&liprop=autonym|name&uselang=en&format=json&formatversion=2&origin=*",
).json<{
  query: { languageinfo: Record<string, { autonym: string; name: string }> };
}>();
const languages = computed<MenuItemData[]>(() =>
  Object.entries(data.value?.query.languageinfo ?? {}).map(
    ([code, { autonym, name }]) => ({
      value: code,
      label: autonym || name,
      match: code,
      description: autonym && autonym !== name ? name : undefined,
    }),
  ),
);

function filter(query: string): MenuItemData[] {
  const q = query.trim().toLowerCase();
  if (!q) return languages.value;
  const rank = (item: MenuItemData) => {
    const code = String(item.value);
    if (code === q) return 0;
    if (code.startsWith(q)) return 1;
    if (item.label?.toLowerCase().startsWith(q)) return 2;
    if (item.description?.toLowerCase().startsWith(q)) return 3;
    if (item.label?.toLowerCase().includes(q)) return 4;
    if (item.description?.toLowerCase().includes(q)) return 5;
    return 6;
  };
  return languages.value
    .map((item) => [rank(item), item] as const)
    .filter(([r]) => r < 6)
    .sort((a, b) => a[0] - b[0])
    .map(([, item]) => item);
}

function onInput(value: string) {
  menuItems.value = filter(value);
}

function onFocus() {
  inputValue.value = "";
  menuItems.value = filter("");
}

function onSelected(code: string | null) {
  // Codex clears the selection while typing; only react to actual choices
  if (!code) return;
  model.value = code;
  inputValue.value = code;
}
</script>

<style scoped>
.dd-language,
.dd-language :deep(.cdx-text-input) {
  width: 13rem;
  min-width: 13rem;
}
</style>
