<template>
  <div
    class="web-drop-layer"
    :class="{ 'is-dragover': dragover }"
    @dragover.prevent="dragover = true"
    @dragleave.prevent="dragover = false"
    @drop.prevent="onDrop"
  >
    <input
      ref="fileInput"
      type="file"
      accept=".lac,application/json"
      class="web-drop-layer__input"
      @change="onPick"
    />
    <button class="web-drop-layer__btn" @click="openPicker">打开 .lac 文件</button>
    <p v-if="empty" class="web-drop-layer__hint">
      拖拽 <strong>.lac</strong> 文件到此处,或点击上方按钮选择
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useSessionStore } from '@frontend-core/stores/sessionStore';
import { fileToDocument } from './fileLoader';
import type { WebHost } from './webHost';
import type { FrontendDocumentData } from '@frontend-platform/host/types';

const sessionStore = useSessionStore();
const fileInput = ref<HTMLInputElement | null>(null);
const dragover = ref(false);
const empty = computed(() => !sessionStore.hasData);

function getHost(): WebHost | undefined {
  return (window as unknown as { __WEB_HOST__?: WebHost }).__WEB_HOST__;
}

function openPicker() {
  fileInput.value?.click();
}

async function loadFile(file: File) {
  try {
    const doc: FrontendDocumentData = await fileToDocument(file);
    getHost()?.loadDocument(doc);
    sessionStore.applyDocument(doc);
    ElMessage.success(`已加载 ${doc.fileName}`);
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载文件失败');
  }
}

function onPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) void loadFile(file);
  // 允许重复选同一文件
  if (fileInput.value) fileInput.value.value = '';
}

function onDrop(e: DragEvent) {
  dragover.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) void loadFile(file);
}

onMounted(() => {
  // 全局拖拽兜底:防止浏览器默认打开文件
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
});
</script>

<style scoped>
.web-drop-layer {
  position: fixed;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  background: var(--el-bg-color, #fff);
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 6px;
}
.web-drop-layer.is-dragover {
  border-color: var(--el-color-primary, #409eff);
}
.web-drop-layer__input {
  display: none;
}
.web-drop-layer__btn {
  cursor: pointer;
}
.web-drop-layer__hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--el-text-color-secondary, #909399);
}
</style>
