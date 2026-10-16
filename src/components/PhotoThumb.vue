<template>
  <span ref="el" class="df-thumb">
    <img v-if="url" :src="url" alt="" loading="lazy" />
  </span>
</template>

<script setup lang="ts">
import { useIntersectionObserver } from "@vueuse/core";
import { ref, useTemplateRef } from "vue";
import { thumbnail } from "../thumbnail";

const props = defineProps<{ file: File }>();
const el = useTemplateRef("el");
const url = ref<string>();

// created once scrolled into view: decoding 100+ photos at once is slow
const { stop } = useIntersectionObserver(el, async ([entry]) => {
  if (!entry?.isIntersecting) return;
  stop();
  url.value = await thumbnail(props.file);
});
</script>

<style scoped>
.df-thumb {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 3rem;
  background: var(--background-color-interactive-subtle);
  border-radius: var(--border-radius-base);
  overflow: hidden;
}
.df-thumb img {
  max-width: 100%;
  max-height: 100%;
}
</style>
