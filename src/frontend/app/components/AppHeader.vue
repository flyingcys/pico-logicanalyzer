<script setup lang="ts">
import { computed } from 'vue';
import { QuestionFilled } from '@element-plus/icons-vue';
import { useUiStore } from '../../core/stores/uiStore';
import LanguageSwitcher from './LanguageSwitcher.vue';
import ShortcutHelpDialog from './ShortcutHelpDialog.vue';

const props = defineProps<{
  title: string;
  hasDocument: boolean;
}>();

const uiStore = useUiStore();

const subtitle = computed(() => (props.hasDocument ? '会话已加载' : '等待文档'));

function openShortcutHelp() {
  uiStore.showShortcutHelp = true;
}
</script>

<template>
  <div class="app-header">
    <div class="app-header__title-group">
      <p class="app-header__eyebrow">
        Pico Logic Analyzer
      </p>
      <h1 class="app-header__title">
        {{ title }}
      </h1>
      <p class="app-header__subtitle">
        {{ subtitle }}
      </p>
    </div>

    <div class="app-header__actions">
      <el-tooltip
        content="快捷键帮助"
        placement="bottom"
      >
        <el-button
          circle
          :icon="QuestionFilled"
          @click="openShortcutHelp"
        />
      </el-tooltip>

      <LanguageSwitcher />
    </div>
    <ShortcutHelpDialog v-model="uiStore.showShortcutHelp" />
  </div>
</template>

<style scoped>
.app-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  background: #0b1120;
}

.app-header__title-group {
  min-width: 0;
}

.app-header__eyebrow,
.app-header__subtitle {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
}

.app-header__eyebrow {
  text-transform: uppercase;
}

.app-header__title {
  margin: 4px 0;
  color: #f8fafc;
  font-size: 20px;
  line-height: 1.2;
}

.app-header__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

@media (max-width: 720px) {
  .app-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .app-header__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
