<template>
  <div class="fixed inset-0 -z-10 overflow-hidden">
    <div
      v-if="bgUrl"
      class="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
      :style="{ backgroundImage: `url(${bgUrl})` }"
    ></div>
    <div class="absolute inset-0 bg-white/70" :class="{ 'bg-white/85': hasBg }"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  bgUrl: string
}>()

const hasBg = computed(() => !!props.bgUrl)
</script>