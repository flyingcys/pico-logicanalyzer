<script setup lang="ts">
import { computed, watch } from 'vue';
import { Cpu, DataAnalysis, VideoPlay } from '@element-plus/icons-vue';
import { useHost } from '../composables/useHost';
import { useDecoderStore } from '../../core/stores/decoderStore';
import { useSessionStore } from '../../core/stores/sessionStore';
import { useUiStore } from '../../core/stores/uiStore';
import { useWaveformStore } from '../../core/stores/waveformStore';
import type { FrontendDecoderId, SPIOptionKey, SPIMappingRole } from '../../core/stores/decoderStore';

type SidebarTab = 'decoder' | 'performance';
type I2CRole = 'scl' | 'sda';

const host = useHost({ fallback: 'auto' });
const uiStore = useUiStore();
const decoderStore = useDecoderStore();
const sessionStore = useSessionStore();
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

const visibleChannels = computed(() => sessionStore.channels
  .map((channel, captureIndex) => ({ captureIndex, channel }))
  .filter(entry => !entry.channel.hidden));

watch(
  () => visibleChannels.value
    .map(entry => `${entry.captureIndex}:${entry.channel.channelNumber}:${entry.channel.channelName}`)
    .join('|'),
  () => {
    decoderStore.initializeDecoderMappings(sessionStore.channels);
  },
  { immediate: true }
);

const decoderStatusText = computed(() => {
  if (!sessionStore.hasData) {
    return '当前文件没有可解码样本';
  }

  if (visibleChannels.value.length < 2) {
    return decoderStore.activeDecoderId === 'spi'
      ? 'SPI 解码需要 CLK 与至少一个数据通道'
      : 'I2C 解码需要至少两个通道';
  }

  return `${sessionStore.totalSamples} 样本 · ${sessionStore.sampleRate} Hz`;
});

const activeDecoderLabel = computed(() =>
  decoderStore.activeDecoderConfigs.find(config => config.decoderId === decoderStore.activeDecoderId)?.label
    ?? 'I2C'
);

const canRunActiveDecoder = computed(() => {
  if (!sessionStore.hasData || decoderStore.channelConflicts.length > 0 || decoderStore.isDecoding) {
    return false;
  }

  if (decoderStore.activeDecoderId === 'spi') {
    return decoderStore.spiMapping.clkCaptureIndex !== null
      && (
        decoderStore.spiMapping.misoCaptureIndex !== null
        || decoderStore.spiMapping.mosiCaptureIndex !== null
      );
  }

  return visibleChannels.value.length >= 2
    && decoderStore.i2cMapping.sclCaptureIndex !== null
    && decoderStore.i2cMapping.sdaCaptureIndex !== null;
});

const decoderSummary = computed(() => [
  {
    label: '结果数',
    value: String(decoderStore.decoderResults.length)
  },
  {
    label: '错误数',
    value: String(decoderStore.decoderErrors.length)
  },
  {
    label: '耗时',
    value: decoderStore.lastExecutionTime === null ? '-' : `${decoderStore.lastExecutionTime} ms`
  }
]);

const visibleDecoderName = computed(() =>
  decoderStore.lastDecoderName && decoderStore.lastDecoderName !== 'I2C'
    ? decoderStore.lastDecoderName
    : ''
);

const resultRows = computed(() => decoderStore.decoderResults.slice(0, 500));

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

function setMappingFromEvent(role: I2CRole, event: Event) {
  const select = event.target as HTMLSelectElement;
  const value = select.value === '' ? null : Number(select.value);
  decoderStore.setI2CMapping(role, Number.isFinite(value) ? value : null);
}

function setSPIMappingFromEvent(role: SPIMappingRole, event: Event) {
  const select = event.target as HTMLSelectElement;
  const value = select.value === '' ? null : Number(select.value);
  decoderStore.setSPIMapping(role, Number.isFinite(value) ? value : null);
}

function setActiveDecoderFromEvent(event: Event) {
  const select = event.target as HTMLSelectElement;
  const decoderId = select.value === 'spi' ? 'spi' : 'i2c';
  decoderStore.setActiveDecoder(decoderId as FrontendDecoderId);
}

function setSPIOptionFromEvent(option: SPIOptionKey, event: Event) {
  const input = event.target as HTMLInputElement | HTMLSelectElement;
  decoderStore.setSPIOption(option, option === 'wordSize' ? Number(input.value) : input.value);
}

async function runActiveDecoder() {
  if (decoderStore.activeDecoderId === 'spi') {
    await decoderStore.runSPIDecoder(host, sessionStore);
  } else {
    await decoderStore.runI2CDecoder(host, sessionStore);
  }
}
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
        <span class="app-sidebar-right__tab-icon">
          <component :is="tab.icon" />
        </span>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <div class="app-sidebar-right__panel">
      <div
        v-if="activeTab === 'decoder'"
        class="app-sidebar-right__content"
      >
        <header class="decoder-panel__header">
          <h2 class="app-sidebar-right__title">
            {{ activeDecoderLabel }} 协议解码
          </h2>
          <p
            v-if="visibleDecoderName"
            class="decoder-panel__decoder-name"
          >
            {{ visibleDecoderName }}
          </p>
          <p class="decoder-panel__status">
            {{ decoderStatusText }}
          </p>
        </header>

        <label class="decoder-panel__field decoder-panel__protocol">
          <span>协议</span>
          <select
            :value="decoderStore.activeDecoderId"
            data-testid="decoder-protocol-select"
            @change="setActiveDecoderFromEvent"
          >
            <option
              v-for="decoder in decoderStore.activeDecoderConfigs"
              :key="decoder.decoderId"
              :value="decoder.decoderId"
            >
              {{ decoder.label }}
            </option>
          </select>
        </label>

        <div
          v-if="decoderStore.activeDecoderId === 'i2c'"
          class="decoder-panel__mapping"
        >
          <label class="decoder-panel__field">
            <span>SCL</span>
            <select
              :value="decoderStore.i2cMapping.sclCaptureIndex ?? ''"
              @change="setMappingFromEvent('scl', $event)"
            >
              <option
                v-for="channel in visibleChannels"
                :key="`scl-${channel.captureIndex}`"
                :value="channel.captureIndex"
              >
                CH{{ channel.channel.channelNumber }} - {{ channel.channel.channelName }}
              </option>
            </select>
          </label>

          <label class="decoder-panel__field">
            <span>SDA</span>
            <select
              :value="decoderStore.i2cMapping.sdaCaptureIndex ?? ''"
              @change="setMappingFromEvent('sda', $event)"
            >
              <option
                v-for="channel in visibleChannels"
                :key="`sda-${channel.captureIndex}`"
                :value="channel.captureIndex"
              >
                CH{{ channel.channel.channelNumber }} - {{ channel.channel.channelName }}
              </option>
            </select>
          </label>
        </div>

        <div
          v-else
          class="decoder-panel__mapping"
        >
          <label class="decoder-panel__field">
            <span>CLK</span>
            <select
              :value="decoderStore.spiMapping.clkCaptureIndex ?? ''"
              @change="setSPIMappingFromEvent('clk', $event)"
            >
              <option value="">
                未映射
              </option>
              <option
                v-for="channel in visibleChannels"
                :key="`spi-clk-${channel.captureIndex}`"
                :value="channel.captureIndex"
              >
                CH{{ channel.channel.channelNumber }} - {{ channel.channel.channelName }}
              </option>
            </select>
          </label>

          <label class="decoder-panel__field">
            <span>MISO</span>
            <select
              :value="decoderStore.spiMapping.misoCaptureIndex ?? ''"
              @change="setSPIMappingFromEvent('miso', $event)"
            >
              <option value="">
                未映射
              </option>
              <option
                v-for="channel in visibleChannels"
                :key="`spi-miso-${channel.captureIndex}`"
                :value="channel.captureIndex"
              >
                CH{{ channel.channel.channelNumber }} - {{ channel.channel.channelName }}
              </option>
            </select>
          </label>

          <label class="decoder-panel__field">
            <span>MOSI</span>
            <select
              :value="decoderStore.spiMapping.mosiCaptureIndex ?? ''"
              @change="setSPIMappingFromEvent('mosi', $event)"
            >
              <option value="">
                未映射
              </option>
              <option
                v-for="channel in visibleChannels"
                :key="`spi-mosi-${channel.captureIndex}`"
                :value="channel.captureIndex"
              >
                CH{{ channel.channel.channelNumber }} - {{ channel.channel.channelName }}
              </option>
            </select>
          </label>

          <label class="decoder-panel__field">
            <span>CS</span>
            <select
              :value="decoderStore.spiMapping.csCaptureIndex ?? ''"
              @change="setSPIMappingFromEvent('cs', $event)"
            >
              <option value="">
                未映射
              </option>
              <option
                v-for="channel in visibleChannels"
                :key="`spi-cs-${channel.captureIndex}`"
                :value="channel.captureIndex"
              >
                CH{{ channel.channel.channelNumber }} - {{ channel.channel.channelName }}
              </option>
            </select>
          </label>
        </div>

        <div
          v-if="decoderStore.activeDecoderId === 'spi'"
          class="decoder-panel__options"
        >
          <label class="decoder-panel__field">
            <span>CS 极性</span>
            <select
              :value="decoderStore.spiOptions.csPolarity"
              @change="setSPIOptionFromEvent('csPolarity', $event)"
            >
              <option value="active-low">
                active-low
              </option>
              <option value="active-high">
                active-high
              </option>
            </select>
          </label>

          <label class="decoder-panel__field">
            <span>CPOL</span>
            <select
              :value="decoderStore.spiOptions.cpol"
              @change="setSPIOptionFromEvent('cpol', $event)"
            >
              <option value="0">
                0
              </option>
              <option value="1">
                1
              </option>
            </select>
          </label>

          <label class="decoder-panel__field">
            <span>CPHA</span>
            <select
              :value="decoderStore.spiOptions.cpha"
              @change="setSPIOptionFromEvent('cpha', $event)"
            >
              <option value="0">
                0
              </option>
              <option value="1">
                1
              </option>
            </select>
          </label>

          <label class="decoder-panel__field">
            <span>Bit order</span>
            <select
              :value="decoderStore.spiOptions.bitOrder"
              @change="setSPIOptionFromEvent('bitOrder', $event)"
            >
              <option value="msb-first">
                msb-first
              </option>
              <option value="lsb-first">
                lsb-first
              </option>
            </select>
          </label>

          <label class="decoder-panel__field">
            <span>Word size</span>
            <input
              type="number"
              min="1"
              max="32"
              step="1"
              :value="decoderStore.spiOptions.wordSize"
              @change="setSPIOptionFromEvent('wordSize', $event)"
            >
          </label>
        </div>

        <div
          v-if="decoderStore.channelConflicts.length > 0"
          class="decoder-panel__errors"
        >
          <p
            v-for="conflict in decoderStore.channelConflicts"
            :key="conflict"
          >
            {{ conflict }}
          </p>
        </div>

        <button
          type="button"
          class="decoder-panel__run"
          :disabled="!canRunActiveDecoder"
          :data-testid="decoderStore.activeDecoderId === 'spi' ? 'run-spi-decoder' : 'run-i2c-decoder'"
          @click="runActiveDecoder"
        >
          <span class="decoder-panel__run-icon">
            <VideoPlay />
          </span>
          <span>{{ decoderStore.isDecoding ? '解码中...' : `运行 ${activeDecoderLabel} 解码` }}</span>
        </button>

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

        <div class="decoder-panel__errors">
          <p>{{ decoderStore.decoderErrors[0] ?? '无错误' }}</p>
        </div>

        <div class="decoder-panel__table-wrap">
          <table class="decoder-panel__table">
            <thead>
              <tr>
                <th>样本区间</th>
                <th>类型</th>
                <th>内容</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="result in resultRows"
                :key="`${result.startSample}-${result.endSample}-${result.annotationType}-${result.values.join('/')}`"
              >
                <td>{{ result.startSample }}-{{ result.endSample }}</td>
                <td>{{ result.annotationType }}</td>
                <td>
                  <strong>{{ result.values[0] }}</strong>
                  <span
                    v-if="result.values.length > 1"
                    class="decoder-panel__detail"
                  >
                    {{ result.values.join(' / ') }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <p
            v-if="decoderStore.decoderResults.length > 500"
            class="decoder-panel__limit"
          >
            已显示前 500 条，共 {{ decoderStore.decoderResults.length }} 条
          </p>
        </div>
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

.app-sidebar-right__tab-icon,
.decoder-panel__run-icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
}

.app-sidebar-right__panel {
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

.app-sidebar-right__content {
  display: grid;
  gap: 16px;
}

.app-sidebar-right__title {
  margin: 0;
  color: #f8fafc;
  font-size: 18px;
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

.decoder-panel__header {
  display: grid;
  gap: 8px;
}

.decoder-panel__status {
  margin: 0;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.4;
}

.decoder-panel__decoder-name {
  margin: 0;
  color: #facc15;
  font-size: 12px;
  line-height: 1.4;
}

.decoder-panel__mapping {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.decoder-panel__protocol {
  max-width: 220px;
}

.decoder-panel__options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.decoder-panel__field {
  display: grid;
  gap: 6px;
  min-width: 0;
  color: #cbd5e1;
  font-size: 12px;
}

.decoder-panel__field select,
.decoder-panel__field input {
  width: 100%;
  min-width: 0;
  height: 34px;
  padding: 0 8px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 6px;
  background: #020617;
  color: #e2e8f0;
  font-size: 13px;
}

.decoder-panel__run {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  border: 1px solid rgba(34, 197, 94, 0.45);
  border-radius: 8px;
  background: rgba(22, 163, 74, 0.18);
  color: #dcfce7;
  cursor: pointer;
}

.decoder-panel__run:disabled {
  border-color: rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.7);
  color: #64748b;
  cursor: not-allowed;
}

.decoder-panel__errors {
  min-height: 34px;
  padding: 9px 10px;
  border: 1px solid rgba(248, 113, 113, 0.22);
  border-radius: 8px;
  background: rgba(127, 29, 29, 0.16);
  color: #fecaca;
  font-size: 12px;
}

.decoder-panel__errors p {
  margin: 0;
}

.decoder-panel__table-wrap {
  min-width: 0;
  overflow: auto;
}

.decoder-panel__table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  color: #e2e8f0;
  font-size: 12px;
}

.decoder-panel__table th,
.decoder-panel__table td {
  padding: 8px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  text-align: left;
  vertical-align: top;
  word-break: break-word;
}

.decoder-panel__table th {
  color: #94a3b8;
  font-weight: 600;
}

.decoder-panel__detail {
  display: block;
  margin-top: 3px;
  color: #94a3b8;
}

.decoder-panel__limit {
  margin: 8px 0 0;
  color: #94a3b8;
  font-size: 12px;
}
</style>
