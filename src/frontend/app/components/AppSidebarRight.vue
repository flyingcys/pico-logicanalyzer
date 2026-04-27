<script setup lang="ts">
import { computed } from 'vue';
import { Cpu, DataAnalysis } from '@element-plus/icons-vue';
import { useDecoderStore } from '../../core/stores/decoderStore';
import { useUiStore } from '../../core/stores/uiStore';
import { useWaveformStore } from '../../core/stores/waveformStore';

type SidebarTab = 'decoder' | 'performance';

const uiStore = useUiStore();
const decoderStore = useDecoderStore();
const waveformStore = useWaveformStore();

const activeTab = computed<SidebarTab>({
  get: () => (uiStore.activeTab === 'performance' ? 'performance' : 'decoder'),
  set: (value) => {
    uiStore.activeTab = value;
  }
});

const tabs = [
  { value: 'decoder' as const, label: '协议解码', icon: DataAnalysis },
  { value: 'performance' as const, label: '性能分析', icon: Cpu }
];

const decoderSummary = computed(() => [
  {
    label: '已登记配置',
    value: String(decoderStore.activeDecoderConfigs.length)
  },
  {
    label: '错误数',
    value: String(decoderStore.decoderErrors.length)
  },
  {
    label: '通道冲突',
    value: String(decoderStore.channelConflicts.length)
  }
]);

const performanceSummary = computed(() => [
  {
    label: '缩放级别',
    value: `${Math.round(waveformStore.zoomLevel * 100)}%`
  },
  {
    label: '首样本偏移',
    value: String(waveformStore.viewRange.firstSample)
  },
  {
    label: '可见样本',
    value: String(waveformStore.viewRange.visibleSamples)
  }
]);
</script>

<template>
  <section class="app-sidebar-right">
    <div class="app-sidebar-right__tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        class="app-sidebar-right__tab"
        :class="{ 'app-sidebar-right__tab--active': activeTab === tab.value }"
        @click="activeTab = tab.value"
      >
        <el-icon>
          <component :is="tab.icon" />
        </el-icon>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <div class="app-sidebar-right__panel">
      <div
        v-if="activeTab === 'decoder'"
        class="app-sidebar-right__content"
      >
        <h2 class="app-sidebar-right__title">
          解码容器
        </h2>
        <p class="app-sidebar-right__subtitle">
          Task 4 先保留面板边界，后续任务再接入真实解码工作流。
        </p>

        <dl class="app-sidebar-right__summary">
          <div
            v-for="item in decoderSummary"
            :key="item.label"
            class="app-sidebar-right__row"
          >
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </div>

      <div
        v-else
        class="app-sidebar-right__content"
      >
        <h2 class="app-sidebar-right__title">
          性能容器
        </h2>
        <p class="app-sidebar-right__subtitle">
          当前只显示 frontend stores 已持有的视图状态，不引入旧性能分析器内部状态。
        </p>

        <dl class="app-sidebar-right__summary">
          <div
            v-for="item in performanceSummary"
            :key="item.label"
            class="app-sidebar-right__row"
          >
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>

<style scoped>
.app-sidebar-right {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 100%;
}

.app-sidebar-right__tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  background: #0f172a;
}

.app-sidebar-right__tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  background: #111827;
  color: #cbd5e1;
  cursor: pointer;
  transition: 0.2s ease;
}

.app-sidebar-right__tab--active {
  border-color: #38bdf8;
  background: rgba(14, 165, 233, 0.14);
  color: #f8fafc;
}

.app-sidebar-right__panel {
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

.app-sidebar-right__content {
  display: grid;
  gap: 20px;
}

.app-sidebar-right__title {
  margin: 0;
  color: #f8fafc;
  font-size: 18px;
}

.app-sidebar-right__subtitle {
  margin: 8px 0 0;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.5;
}

.app-sidebar-right__summary {
  display: grid;
  gap: 12px;
  margin: 0;
}

.app-sidebar-right__row {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.6);
}

.app-sidebar-right__row dt {
  color: #94a3b8;
  font-size: 12px;
}

.app-sidebar-right__row dd {
  margin: 0;
  color: #e2e8f0;
  font-size: 14px;
}
</style>
