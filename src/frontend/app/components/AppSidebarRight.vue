<script setup lang="ts">
import { computed, watch } from 'vue';
import { Cpu, DataAnalysis, VideoPlay } from '@element-plus/icons-vue';
import { useHost } from '../composables/useHost';
import {
  useDecoderStore,
  type FrontendDecoderId,
  type I2SJustification,
  type LINChecksumMode,
  type UARTOptionState
} from '../../core/stores/decoderStore';
import { useSessionStore } from '../../core/stores/sessionStore';
import { useUiStore } from '../../core/stores/uiStore';
import { useWaveformStore } from '../../core/stores/waveformStore';

type SidebarTab = 'decoder' | 'performance';
type I2CRole = 'scl' | 'sda';
type UARTRole = 'rx' | 'tx';
type I2SRole = 'sck' | 'ws' | 'sd';

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
    decoderStore.initializeChannelMappings(sessionStore.channels);
  },
  { immediate: true }
);

const selectedDecoderConfig = computed(() =>
  decoderStore.activeDecoderConfigs.find(config => config.decoderId === decoderStore.selectedDecoderId)
    ?? decoderStore.activeDecoderConfigs[0]
);

const selectedDecoderLabel = computed(() => selectedDecoderConfig.value?.label ?? 'I2C');

const decoderStatusText = computed(() => {
  if (!sessionStore.hasData) {
    return '当前文件没有可解码样本';
  }

  if (decoderStore.selectedDecoderId === 'i2c' && visibleChannels.value.length < 2) {
    return 'I2C 解码需要至少两个通道';
  }

  if (decoderStore.selectedDecoderId === 'uart' && visibleChannels.value.length < 1) {
    return 'UART 解码需要至少一个 RX 或 TX 通道';
  }

  if (decoderStore.selectedDecoderId === 'can' && visibleChannels.value.length < 1) {
    return 'CAN 解码需要 CAN RX 通道';
  }

  if (decoderStore.selectedDecoderId === 'lin' && visibleChannels.value.length < 1) {
    return 'LIN 解码需要 RX 通道';
  }

  if (decoderStore.selectedDecoderId === 'i2s' && visibleChannels.value.length < 3) {
    return 'I2S 解码需要至少三个通道';
  }

  return `${sessionStore.totalSamples} 样本 · ${sessionStore.sampleRate} Hz`;
});

const canRunDecoder = computed(() => {
  if (!sessionStore.hasData || decoderStore.channelConflicts.length > 0 || decoderStore.isDecoding) {
    return false;
  }

  if (decoderStore.selectedDecoderId === 'i2c') {
    return visibleChannels.value.length >= 2
      && decoderStore.i2cMapping.sclCaptureIndex !== null
      && decoderStore.i2cMapping.sdaCaptureIndex !== null;
  }

  if (decoderStore.selectedDecoderId === 'uart') {
    return visibleChannels.value.length >= 1
      && (decoderStore.uartMapping.rxCaptureIndex !== null || decoderStore.uartMapping.txCaptureIndex !== null);
  }

  if (decoderStore.selectedDecoderId === 'can') {
    return visibleChannels.value.length >= 1 && decoderStore.canMapping.rxCaptureIndex !== null;
  }

  if (decoderStore.selectedDecoderId === 'lin') {
    return visibleChannels.value.length >= 1 && decoderStore.linMapping.rxCaptureIndex !== null;
  }

  return visibleChannels.value.length >= 3
    && decoderStore.i2sMapping.sckCaptureIndex !== null
    && decoderStore.i2sMapping.wsCaptureIndex !== null
    && decoderStore.i2sMapping.sdCaptureIndex !== null;
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
  },
  {
    label: '模式',
    value: decoderStore.lastExecutionMode === null
      ? '-'
      : decoderStore.lastExecutionMode === 'streaming'
        ? '流式'
        : '常规'
  },
  {
    label: '分块',
    value: decoderStore.lastChunksProcessed === null ? '-' : `${decoderStore.lastChunksProcessed} 块`
  }
]);

const visibleDecoderName = computed(() =>
  decoderStore.lastDecoderName && decoderStore.lastDecoderName !== selectedDecoderLabel.value
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

function readSelectNumber(event: Event): number | null {
  const select = event.target as HTMLSelectElement;
  const value = select.value === '' ? null : Number(select.value);
  return Number.isFinite(value) ? value : null;
}

function setI2CMappingFromEvent(role: I2CRole, event: Event) {
  decoderStore.setI2CMapping(role, readSelectNumber(event));
}

function setUARTMappingFromEvent(role: UARTRole, event: Event) {
  decoderStore.setUARTMapping(role, readSelectNumber(event));
}

function setCANMappingFromEvent(event: Event) {
  decoderStore.setCANMapping(readSelectNumber(event));
}

function setLINMappingFromEvent(event: Event) {
  decoderStore.setLINMapping(readSelectNumber(event));
}

function setI2SMappingFromEvent(role: I2SRole, event: Event) {
  decoderStore.setI2SMapping(role, readSelectNumber(event));
}

function setSelectedDecoderFromEvent(event: Event) {
  const select = event.target as HTMLSelectElement;
  decoderStore.setSelectedDecoder(select.value as FrontendDecoderId);
}

function setUARTNumberOption(option: 'baudrate' | 'samplePoint', event: Event) {
  const input = event.target as HTMLInputElement;
  const fallback = option === 'baudrate' ? 115200 : 50;
  const value = Number(input.value);
  decoderStore.setUARTOption(option, (Number.isFinite(value) && value > 0 ? value : fallback) as UARTOptionState[typeof option]);
}

function setUARTStringOption(option: 'dataBits' | 'parity' | 'stopBits', event: Event) {
  const select = event.target as HTMLSelectElement;
  decoderStore.setUARTOption(option, select.value);
}

function setUARTBooleanOption(option: 'invertRx' | 'invertTx', event: Event) {
  const input = event.target as HTMLInputElement;
  decoderStore.setUARTOption(option, input.checked);
}

function setCANOptionFromEvent(option: 'bitrate' | 'samplePoint', event: Event) {
  const input = event.target as HTMLInputElement;
  decoderStore.setCANOption(option, Number(input.value));
}

function setLINNumberOption(option: 'baudrate' | 'dataLength', event: Event) {
  const input = event.target as HTMLInputElement;
  decoderStore.setLINOption(option, Number(input.value));
}

function setLINChecksumFromEvent(event: Event) {
  const select = event.target as HTMLSelectElement;
  decoderStore.setLINOption('checksum', select.value as LINChecksumMode);
}

function setI2SOptionFromEvent(option: 'word_length' | 'justification', event: Event) {
  const select = event.target as HTMLSelectElement;
  if (option === 'word_length') {
    decoderStore.setI2SOption(option, Number(select.value));
  } else {
    decoderStore.setI2SOption(option, (select.value === 'left' ? 'left' : 'i2s') as I2SJustification);
  }
}

async function runDecoder() {
  await decoderStore.runSelectedDecoder(host, sessionStore);
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
            {{ selectedDecoderLabel }} 协议解码
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

        <label class="decoder-panel__field decoder-panel__field--full">
          <span>协议</span>
          <select
            data-testid="decoder-protocol-select"
            :value="decoderStore.selectedDecoderId"
            @change="setSelectedDecoderFromEvent"
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
          v-if="decoderStore.selectedDecoderId === 'i2c'"
          class="decoder-panel__mapping"
        >
          <label class="decoder-panel__field">
            <span>SCL</span>
            <select
              :value="decoderStore.i2cMapping.sclCaptureIndex ?? ''"
              @change="setI2CMappingFromEvent('scl', $event)"
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
              @change="setI2CMappingFromEvent('sda', $event)"
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
          v-if="decoderStore.selectedDecoderId === 'uart'"
          class="decoder-panel__mapping"
        >
          <label class="decoder-panel__field">
            <span>RX</span>
            <select
              :value="decoderStore.uartMapping.rxCaptureIndex ?? ''"
              @change="setUARTMappingFromEvent('rx', $event)"
            >
              <option value="">
                未使用
              </option>
              <option
                v-for="channel in visibleChannels"
                :key="`rx-${channel.captureIndex}`"
                :value="channel.captureIndex"
              >
                CH{{ channel.channel.channelNumber }} - {{ channel.channel.channelName }}
              </option>
            </select>
          </label>

          <label class="decoder-panel__field">
            <span>TX</span>
            <select
              :value="decoderStore.uartMapping.txCaptureIndex ?? ''"
              @change="setUARTMappingFromEvent('tx', $event)"
            >
              <option value="">
                未使用
              </option>
              <option
                v-for="channel in visibleChannels"
                :key="`tx-${channel.captureIndex}`"
                :value="channel.captureIndex"
              >
                CH{{ channel.channel.channelNumber }} - {{ channel.channel.channelName }}
              </option>
            </select>
          </label>
        </div>

        <div
          v-if="decoderStore.selectedDecoderId === 'can'"
          class="decoder-panel__mapping"
        >
          <label class="decoder-panel__field">
            <span>CAN RX</span>
            <select
              :value="decoderStore.canMapping.rxCaptureIndex ?? ''"
              @change="setCANMappingFromEvent"
            >
              <option
                v-for="channel in visibleChannels"
                :key="`can-${channel.captureIndex}`"
                :value="channel.captureIndex"
              >
                CH{{ channel.channel.channelNumber }} - {{ channel.channel.channelName }}
              </option>
            </select>
          </label>

          <label class="decoder-panel__field">
            <span>Bitrate</span>
            <input
              type="number"
              min="1"
              step="1000"
              :value="decoderStore.canOptions.bitrate"
              @input="setCANOptionFromEvent('bitrate', $event)"
            >
          </label>

          <label class="decoder-panel__field">
            <span>Sample %</span>
            <input
              type="number"
              min="1"
              max="99"
              step="1"
              :value="decoderStore.canOptions.samplePoint"
              @input="setCANOptionFromEvent('samplePoint', $event)"
            >
          </label>
        </div>

        <div
          v-if="decoderStore.selectedDecoderId === 'lin'"
          class="decoder-panel__mapping"
        >
          <label class="decoder-panel__field">
            <span>RX</span>
            <select
              :value="decoderStore.linMapping.rxCaptureIndex ?? ''"
              @change="setLINMappingFromEvent"
            >
              <option
                v-for="channel in visibleChannels"
                :key="`lin-rx-${channel.captureIndex}`"
                :value="channel.captureIndex"
              >
                CH{{ channel.channel.channelNumber }} - {{ channel.channel.channelName }}
              </option>
            </select>
          </label>

          <label class="decoder-panel__field">
            <span>Baud</span>
            <input
              type="number"
              min="1"
              step="1"
              :value="decoderStore.linOptions.baudrate"
              @change="setLINNumberOption('baudrate', $event)"
            >
          </label>

          <label class="decoder-panel__field">
            <span>Data</span>
            <input
              type="number"
              min="0"
              step="1"
              :value="decoderStore.linOptions.dataLength"
              @change="setLINNumberOption('dataLength', $event)"
            >
          </label>

          <label class="decoder-panel__field">
            <span>Checksum</span>
            <select
              :value="decoderStore.linOptions.checksum"
              @change="setLINChecksumFromEvent"
            >
              <option value="classic">classic</option>
              <option value="enhanced">enhanced</option>
              <option value="lin1.x">LIN 1.x</option>
              <option value="lin2.x">LIN 2.x</option>
            </select>
          </label>
        </div>

        <div
          v-if="decoderStore.selectedDecoderId === 'i2s'"
          class="decoder-panel__mapping decoder-panel__mapping--triple"
        >
          <label class="decoder-panel__field">
            <span>SCK</span>
            <select
              :value="decoderStore.i2sMapping.sckCaptureIndex ?? ''"
              @change="setI2SMappingFromEvent('sck', $event)"
            >
              <option
                v-for="channel in visibleChannels"
                :key="`sck-${channel.captureIndex}`"
                :value="channel.captureIndex"
              >
                CH{{ channel.channel.channelNumber }} - {{ channel.channel.channelName }}
              </option>
            </select>
          </label>

          <label class="decoder-panel__field">
            <span>WS</span>
            <select
              :value="decoderStore.i2sMapping.wsCaptureIndex ?? ''"
              @change="setI2SMappingFromEvent('ws', $event)"
            >
              <option
                v-for="channel in visibleChannels"
                :key="`ws-${channel.captureIndex}`"
                :value="channel.captureIndex"
              >
                CH{{ channel.channel.channelNumber }} - {{ channel.channel.channelName }}
              </option>
            </select>
          </label>

          <label class="decoder-panel__field">
            <span>SD</span>
            <select
              :value="decoderStore.i2sMapping.sdCaptureIndex ?? ''"
              @change="setI2SMappingFromEvent('sd', $event)"
            >
              <option
                v-for="channel in visibleChannels"
                :key="`sd-${channel.captureIndex}`"
                :value="channel.captureIndex"
              >
                CH{{ channel.channel.channelNumber }} - {{ channel.channel.channelName }}
              </option>
            </select>
          </label>
        </div>

        <div
          v-if="decoderStore.selectedDecoderId === 'uart'"
          class="decoder-panel__options"
        >
          <label class="decoder-panel__field">
            <span>Baudrate</span>
            <input
              data-testid="uart-baudrate-input"
              type="number"
              min="1"
              step="1"
              :value="decoderStore.uartOptions.baudrate"
              @input="setUARTNumberOption('baudrate', $event)"
            >
          </label>

          <label class="decoder-panel__field">
            <span>Data bits</span>
            <select
              :value="decoderStore.uartOptions.dataBits"
              @change="setUARTStringOption('dataBits', $event)"
            >
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9</option>
            </select>
          </label>

          <label class="decoder-panel__field">
            <span>Parity</span>
            <select
              :value="decoderStore.uartOptions.parity"
              @change="setUARTStringOption('parity', $event)"
            >
              <option value="none">none</option>
              <option value="odd">odd</option>
              <option value="even">even</option>
              <option value="zero">zero</option>
              <option value="one">one</option>
              <option value="ignore">ignore</option>
            </select>
          </label>

          <label class="decoder-panel__field">
            <span>Stop bits</span>
            <select
              :value="decoderStore.uartOptions.stopBits"
              @change="setUARTStringOption('stopBits', $event)"
            >
              <option value="0.0">0.0</option>
              <option value="0.5">0.5</option>
              <option value="1.0">1.0</option>
              <option value="1.5">1.5</option>
              <option value="2.0">2.0</option>
            </select>
          </label>

          <label class="decoder-panel__check">
            <input
              type="checkbox"
              :checked="decoderStore.uartOptions.invertRx"
              @change="setUARTBooleanOption('invertRx', $event)"
            >
            <span>Invert RX</span>
          </label>

          <label class="decoder-panel__check">
            <input
              type="checkbox"
              :checked="decoderStore.uartOptions.invertTx"
              @change="setUARTBooleanOption('invertTx', $event)"
            >
            <span>Invert TX</span>
          </label>

          <label class="decoder-panel__field">
            <span>Sample point</span>
            <input
              type="number"
              min="1"
              max="99"
              step="1"
              :value="decoderStore.uartOptions.samplePoint"
              @input="setUARTNumberOption('samplePoint', $event)"
            >
          </label>
        </div>

        <div
          v-if="decoderStore.selectedDecoderId === 'i2s'"
          class="decoder-panel__options"
        >
          <label class="decoder-panel__field">
            <span>字长</span>
            <select
              data-testid="i2s-word-length"
              :value="decoderStore.i2sOptions.wordLength"
              @change="setI2SOptionFromEvent('word_length', $event)"
            >
              <option value="16">16 bit</option>
              <option value="24">24 bit</option>
              <option value="32">32 bit</option>
            </select>
          </label>

          <label class="decoder-panel__field">
            <span>对齐</span>
            <select
              :value="decoderStore.i2sOptions.justification"
              @change="setI2SOptionFromEvent('justification', $event)"
            >
              <option value="i2s">I2S</option>
              <option value="left">Left justified</option>
            </select>
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
          :disabled="!canRunDecoder"
          :data-testid="`run-${decoderStore.selectedDecoderId}-decoder`"
          @click="runDecoder"
        >
          <span class="decoder-panel__run-icon">
            <VideoPlay />
          </span>
          <span>{{ decoderStore.isDecoding ? '解码中...' : `运行 ${selectedDecoderLabel} 解码` }}</span>
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

.decoder-panel__mapping,
.decoder-panel__options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.decoder-panel__mapping--triple {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.decoder-panel__field {
  display: grid;
  gap: 6px;
  min-width: 0;
  color: #cbd5e1;
  font-size: 12px;
}

.decoder-panel__field--full {
  width: 100%;
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

.decoder-panel__check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  color: #cbd5e1;
  font-size: 12px;
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
