<script setup lang="ts">
import { computed } from 'vue';
import { useDeviceStore } from '../../core/stores/deviceStore';
import { useSessionStore } from '../../core/stores/sessionStore';

const deviceStore = useDeviceStore();
const sessionStore = useSessionStore();

const deviceStatus = computed(() => {
  if (deviceStore.isCapturing) {
    return '采集中';
  }

  if (deviceStore.isConnecting) {
    return '连接中';
  }

  if (deviceStore.isConnected) {
    return '已连接';
  }

  return '未连接';
});

const summaryItems = computed(() => [
  {
    label: '文档',
    value: sessionStore.fileName || '未加载'
  },
  {
    label: '设备',
    value: deviceStatus.value
  },
  {
    label: '数据',
    value: sessionStore.hasData ? '已解析' : '无数据'
  }
]);
</script>

<template>
  <section class="app-sidebar-left">
    <div class="app-sidebar-left__panel">
      <header class="app-sidebar-left__header">
        <h2 class="app-sidebar-left__title">
          设备容器
        </h2>
        <p class="app-sidebar-left__subtitle">
          Task 4 仅保留布局与状态摘要，不直接挂接旧设备管理器。
        </p>
      </header>

      <dl class="app-sidebar-left__summary">
        <div
          v-for="item in summaryItems"
          :key="item.label"
          class="app-sidebar-left__row"
        >
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.app-sidebar-left {
  min-height: 100%;
  padding: 16px;
}

.app-sidebar-left__panel {
  display: grid;
  gap: 20px;
}

.app-sidebar-left__title {
  margin: 0;
  color: #f8fafc;
  font-size: 18px;
}

.app-sidebar-left__subtitle {
  margin: 8px 0 0;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.5;
}

.app-sidebar-left__summary {
  display: grid;
  gap: 12px;
  margin: 0;
}

.app-sidebar-left__row {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.6);
}

.app-sidebar-left__row dt {
  color: #94a3b8;
  font-size: 12px;
}

.app-sidebar-left__row dd {
  margin: 0;
  color: #e2e8f0;
  font-size: 14px;
}
</style>
