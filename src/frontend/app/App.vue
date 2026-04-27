<script setup lang="ts">
import { computed } from 'vue';
import { useSessionStore } from '../core/stores/sessionStore';

const sessionStore = useSessionStore();
const title = computed(() => sessionStore.fileName || 'Logic Analyzer');
</script>

<template>
  <div class="frontend-app">
    <header class="frontend-app__header">
      {{ title }}
    </header>
    <main class="frontend-app__main" />
  </div>
</template>
