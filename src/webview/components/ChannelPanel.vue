<!--
通道控制面板组件
基于 @logicanalyzer/Software 的 ChannelViewer 功能
提供通道显示、命名、颜色和可见性控制
-->

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import {
    DataLine,
    View,
    Hide,
    More,
    Search,
    ArrowDown
  } from '@element-plus/icons-vue';
  import { ElMessage, ElMessageBox } from 'element-plus';

  // 接口定义
  interface ChannelData {
    number: number;
    name: string;
    color: string;
    hidden: boolean;
    hasData: boolean;
    hasAnnotations: boolean;
    sampleCount: number;
    dataRate: number;
    logicLevel?: string;
    threshold?: string;
    samples?: Uint8Array;
  }

  // Props
  interface Props {
    channels?: ChannelData[];
    selectedChannelNumber?: number;
  }

  const props = withDefaults(defineProps<Props>(), {
    channels: () => [],
    selectedChannelNumber: -1
  });

  // Emits
  const emit = defineEmits<{
    'channel-click': [channel: ChannelData];
    'channel-visibility-changed': [channel: ChannelData];
    'channel-name-changed': [channel: ChannelData];
    'channel-color-changed': [channel: ChannelData];
    'channels-updated': [channels: ChannelData[]];
  }>();

  // 响应式数据
  const localChannels = ref<ChannelData[]>([]);
  const selectedChannel = ref<ChannelData | null>(null);
  const searchQuery = ref('');
  const visibilityFilter = ref('');

  // 颜色选择器
  const showColorPicker = ref(false);
  const currentChannelColor = ref('#ff0000');
  const selectedChannelForColor = ref<ChannelData | null>(null);

  // 批量重命名
  const showBatchRename = ref(false);
  const batchRenameForm = ref({
    pattern: 'CH{N}',
    customPrefix: 'GPIO',
    startNumber: 0,
    scope: ['visible']
  });

  // 预设颜色
  const presetChannelColors = [
    '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
    '#ffa500', '#800080', '#008000', '#000080', '#808080', '#ffc0cb',
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe',
    '#fd79a8', '#e17055', '#00b894', '#0984e3', '#b2bec3', '#636e72'
  ];

  // 计算属性
  const filteredChannels = computed(() => {
    let filtered = localChannels.value;

    // 搜索过滤
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter(
        channel =>
          channel.name.toLowerCase().includes(query) ||
          `ch${channel.number}`.includes(query) ||
          channel.number.toString().includes(query)
      );
    }

    // 可见性过滤
    if (visibilityFilter.value === 'visible') {
      filtered = filtered.filter(channel => !channel.hidden);
    } else if (visibilityFilter.value === 'hidden') {
      filtered = filtered.filter(channel => channel.hidden);
    }

    return filtered;
  });

  const visibleChannelCount = computed(() => {
    return localChannels.value.filter(ch => !ch.hidden).length;
  });

  const channelsWithData = computed(() => {
    return localChannels.value.filter(ch => ch.hasData).length;
  });

  // 方法
  const initializeChannels = () => {
    if (props.channels && props.channels.length > 0) {
      localChannels.value = [...props.channels];
    } else {
      // 创建默认通道
      localChannels.value = [];
      for (let i = 0; i < 24; i++) {
        localChannels.value.push({
          number: i,
          name: `CH${i}`,
          color: getDefaultChannelColor(i),
          hidden: false,
          hasData: Math.random() > 0.7, // 模拟数据
          hasAnnotations: Math.random() > 0.8,
          sampleCount: Math.floor(Math.random() * 100000),
          dataRate: Math.floor(Math.random() * 10000000),
          logicLevel: 'TTL',
          threshold: '1.65V'
        });
      }
    }
  };

  const getDefaultChannelColor = (channelNumber: number): string => {
    return presetChannelColors[channelNumber % presetChannelColors.length];
  };

  const selectChannel = (channel: ChannelData) => {
    selectedChannel.value = selectedChannel.value?.number === channel.number ? null : channel;
    emit('channel-click', channel);
  };

  const toggleChannelVisibility = (channel: ChannelData) => {
    channel.hidden = !channel.hidden;
    emit('channel-visibility-changed', channel);
    emit('channels-updated', localChannels.value);
  };

  const updateChannelName = (channel: ChannelData) => {
    if (!channel.name.trim()) {
      channel.name = `CH${channel.number}`;
    }
    emit('channel-name-changed', channel);
    emit('channels-updated', localChannels.value);
  };

  const showChannelColorPicker = (channel: ChannelData) => {
    selectedChannelForColor.value = channel;
    currentChannelColor.value = channel.color;
    showColorPicker.value = true;
  };

  const selectChannelColor = (color: string) => {
    currentChannelColor.value = color;
  };

  const generateRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    currentChannelColor.value = color;
  };

  const confirmChannelColorSelection = () => {
    if (selectedChannelForColor.value) {
      selectedChannelForColor.value.color = currentChannelColor.value;
      emit('channel-color-changed', selectedChannelForColor.value);
      emit('channels-updated', localChannels.value);
    }
    showColorPicker.value = false;
  };

  const showAllChannels = () => {
    localChannels.value.forEach(ch => (ch.hidden = false));
    emit('channels-updated', localChannels.value);
    ElMessage.success('已显示所有通道');
  };

  const hideAllChannels = () => {
    localChannels.value.forEach(ch => (ch.hidden = true));
    emit('channels-updated', localChannels.value);
    ElMessage.success('已隐藏所有通道');
  };

  const handleChannelAction = (command: string) => {
    switch (command) {
      case 'rename-batch':
        showBatchRename.value = true;
        break;
      case 'reset-colors':
        resetChannelColors();
        break;
      case 'export-config':
        exportChannelConfig();
        break;
      case 'import-config':
        importChannelConfig();
        break;
    }
  };

  const handleChannelCommand = (command: string, channel: ChannelData) => {
    switch (command) {
      case 'goto-start':
        ElMessage.info(`跳转到通道 ${channel.name} 开始`);
        break;
      case 'goto-end':
        ElMessage.info(`跳转到通道 ${channel.name} 结束`);
        break;
      case 'measure-frequency':
        ElMessage.info(`测量通道 ${channel.name} 频率`);
        break;
      case 'add-marker':
        ElMessage.info(`在通道 ${channel.name} 添加标记`);
        break;
      case 'export-data':
        ElMessage.info(`导出通道 ${channel.name} 数据`);
        break;
    }
  };

  const resetChannelColors = async () => {
    try {
      await ElMessageBox.confirm('确定要重置所有通道颜色吗？', '确认重置', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      });

      localChannels.value.forEach((ch, index) => {
        ch.color = getDefaultChannelColor(index);
      });

      emit('channels-updated', localChannels.value);
      ElMessage.success('通道颜色已重置');
    } catch {
      // 用户取消
    }
  };

  const applyBatchRename = () => {
    const form = batchRenameForm.value;
    let targetChannels = localChannels.value;

    if (form.scope.includes('visible') && !form.scope.includes('all')) {
      targetChannels = localChannels.value.filter(ch => !ch.hidden);
    }

    targetChannels.forEach((channel, index) => {
      let newName = '';
      const number = form.startNumber + index;

      switch (form.pattern) {
        case 'CH{N}':
          newName = `CH${number}`;
          break;
        case 'Channel {N}':
          newName = `Channel ${number}`;
          break;
        case 'D{N}':
          newName = `D${number}`;
          break;
        case 'custom':
          newName = `${form.customPrefix}${number}`;
          break;
      }

      channel.name = newName;
    });

    emit('channels-updated', localChannels.value);
    showBatchRename.value = false;
    ElMessage.success(`已重命名 ${targetChannels.length} 个通道`);
  };

  const exportChannelConfig = () => {
    const config = {
      timestamp: new Date().toISOString(),
      channels: localChannels.value.map(ch => ({
        number: ch.number,
        name: ch.name,
        color: ch.color,
        hidden: ch.hidden
      }))
    };

    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'channel-config.json';
    link.click();
    URL.revokeObjectURL(url);

    ElMessage.success('通道配置已导出');
  };

  const importChannelConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target?.result as string);
          if (config.channels && Array.isArray(config.channels)) {
            config.channels.forEach((ch: any) => {
              const existingChannel = localChannels.value.find(c => c.number === ch.number);
              if (existingChannel) {
                existingChannel.name = ch.name || existingChannel.name;
                existingChannel.color = ch.color || existingChannel.color;
                existingChannel.hidden = ch.hidden !== undefined ? ch.hidden : existingChannel.hidden;
              }
            });
            emit('channels-updated', localChannels.value);
            ElMessage.success('通道配置已导入');
          }
        } catch (error) {
          ElMessage.error('配置文件格式错误');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // 格式化函数
  const formatSampleCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const formatDataRate = (rate: number): string => {
    if (rate >= 1000000000) {
      return `${(rate / 1000000000).toFixed(1)}GHz`;
    } else if (rate >= 1000000) {
      return `${(rate / 1000000).toFixed(1)}MHz`;
    } else if (rate >= 1000) {
      return `${(rate / 1000).toFixed(1)}KHz`;
    }
    return `${rate}Hz`;
  };

  // 监听器
  watch(
    () => props.channels,
    () => {
      initializeChannels();
    },
    { deep: true, immediate: true }
  );

  watch(
    () => props.selectedChannelNumber,
    (newNumber) => {
      if (newNumber >= 0) {
        selectedChannel.value = localChannels.value.find(ch => ch.number === newNumber) || null;
      } else {
        selectedChannel.value = null;
      }
    }
  );

  // 生命周期
  onMounted(() => {
    initializeChannels();
  });
</script>

<template>
  <div class="channel-panel">
    <!-- 通道面板头部 -->
    <div class="channel-header">
      <h3 class="channel-title">
        <el-icon><DataLine /></el-icon>
        通道控制
      </h3>
      <div class="channel-actions">
        <el-button-group size="small">
          <el-button
            :icon="View"
            title="显示全部"
            @click="showAllChannels"
          >
            显示全部
          </el-button>
          <el-button
            :icon="Hide"
            title="隐藏全部"
            @click="hideAllChannels"
          >
            隐藏全部
          </el-button>
        </el-button-group>
        <el-dropdown @command="handleChannelAction">
          <el-button
            size="small"
            :icon="More"
          >
            更多
            <el-icon class="el-icon--right">
              <ArrowDown />
            </el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="rename-batch">
                批量重命名
              </el-dropdown-item>
              <el-dropdown-item command="reset-colors">
                重置颜色
              </el-dropdown-item>
              <el-dropdown-item command="export-config">
                导出配置
              </el-dropdown-item>
              <el-dropdown-item command="import-config">
                导入配置
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 通道过滤器 -->
    <div class="channel-filters">
      <el-input
        v-model="searchQuery"
        placeholder="搜索通道..."
        :prefix-icon="Search"
        size="small"
        clearable
        class="search-input"
      />
      <el-select
        v-model="visibilityFilter"
        placeholder="显示状态"
        size="small"
        class="filter-select"
        clearable
      >
        <el-option
          label="全部"
          value=""
        />
        <el-option
          label="显示中"
          value="visible"
        />
        <el-option
          label="隐藏中"
          value="hidden"
        />
      </el-select>
    </div>

    <!-- 通道列表 -->
    <div class="channels-container">
      <div
        v-if="filteredChannels.length === 0"
        class="no-channels"
      >
        <el-empty
          :image-size="60"
          description="没有找到匹配的通道"
        />
      </div>

      <div
        v-else
        class="channels-list"
      >
        <div
          v-for="(channel, index) in filteredChannels"
          :key="channel.number"
          class="channel-item"
          :class="{
            hidden: channel.hidden,
            selected: selectedChannel?.number === channel.number,
            'even-row': index % 2 === 0,
            'odd-row': index % 2 === 1
          }"
        >
          <!-- 通道头部 -->
          <div
            class="channel-header-row"
            @click="selectChannel(channel)"
          >
            <div class="channel-info">
              <div class="channel-visibility">
                <el-button
                  :icon="channel.hidden ? Hide : View"
                  size="small"
                  text
                  :class="{ hidden: channel.hidden }"
                  :title="channel.hidden ? '显示通道' : '隐藏通道'"
                  @click.stop="toggleChannelVisibility(channel)"
                />
              </div>

              <div class="channel-number">
                <span
                  class="channel-label"
                  :style="{ color: channel.color }"
                  :title="`通道 ${channel.number}`"
                >
                  CH{{ channel.number }}
                </span>
              </div>

              <div class="channel-color-indicator">
                <div
                  class="color-dot"
                  :style="{ backgroundColor: channel.color }"
                  :title="'点击更改颜色'"
                  @click.stop="showChannelColorPicker(channel)"
                />
              </div>

              <div class="channel-status">
                <el-tag
                  v-if="channel.hasData"
                  size="small"
                  type="success"
                >
                  有数据
                </el-tag>
                <el-tag
                  v-if="channel.hasAnnotations"
                  size="small"
                  type="info"
                >
                  有注释
                </el-tag>
              </div>
            </div>

            <div class="channel-controls">
              <el-dropdown @command="(cmd) => handleChannelCommand(cmd, channel)">
                <el-button
                  :icon="More"
                  size="small"
                  text
                />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="goto-start">
                      跳转到开始
                    </el-dropdown-item>
                    <el-dropdown-item command="goto-end">
                      跳转到结束
                    </el-dropdown-item>
                    <el-dropdown-item command="measure-frequency">
                      测量频率
                    </el-dropdown-item>
                    <el-dropdown-item command="add-marker">
                      添加标记
                    </el-dropdown-item>
                    <el-dropdown-item
                      divided
                      command="export-data"
                    >
                      导出数据
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <!-- 通道名称编辑 -->
          <div class="channel-name-row">
            <el-input
              v-model="channel.name"
              size="small"
              placeholder="输入通道名称..."
              class="channel-name-input"
              @blur="updateChannelName(channel)"
              @keyup.enter="updateChannelName(channel)"
            />
          </div>

          <!-- 通道详细信息（展开时显示） -->
          <div
            v-if="selectedChannel?.number === channel.number"
            class="channel-details"
          >
            <div class="detail-item">
              <span class="detail-label">样本数:</span>
              <span class="detail-value">{{ formatSampleCount(channel.sampleCount) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">数据率:</span>
              <span class="detail-value">{{ formatDataRate(channel.dataRate) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">电平:</span>
              <span class="detail-value">{{ channel.logicLevel || 'TTL' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">阈值:</span>
              <span class="detail-value">{{ channel.threshold || '1.65V' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 通道统计信息 -->
    <div class="channel-stats">
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-label">总通道:</span>
          <span class="stat-value">{{ channels.length }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">显示:</span>
          <span class="stat-value">{{ visibleChannelCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">有数据:</span>
          <span class="stat-value">{{ channelsWithData }}</span>
        </div>
      </div>
    </div>

    <!-- 颜色选择器对话框 -->
    <el-dialog
      v-model="showColorPicker"
      title="选择通道颜色"
      width="400px"
    >
      <div class="color-picker">
        <div class="preset-colors">
          <div
            v-for="color in presetChannelColors"
            :key="color"
            class="color-item"
            :style="{ backgroundColor: color }"
            :class="{ selected: currentChannelColor === color }"
            @click="selectChannelColor(color)"
          />
        </div>
        <div class="custom-color">
          <el-input
            v-model="currentChannelColor"
            placeholder="#RRGGBB"
            class="color-input"
          />
          <el-button @click="generateRandomColor">
            随机
          </el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="showColorPicker = false">
          取消
        </el-button>
        <el-button
          type="primary"
          @click="confirmChannelColorSelection"
        >
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 批量重命名对话框 -->
    <el-dialog
      v-model="showBatchRename"
      title="批量重命名通道"
      width="500px"
    >
      <div class="batch-rename">
        <el-form
          :model="batchRenameForm"
          label-width="100px"
        >
          <el-form-item label="命名模式">
            <el-select v-model="batchRenameForm.pattern">
              <el-option
                label="CH{N}"
                value="CH{N}"
              />
              <el-option
                label="Channel {N}"
                value="Channel {N}"
              />
              <el-option
                label="D{N}"
                value="D{N}"
              />
              <el-option
                label="自定义前缀"
                value="custom"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="batchRenameForm.pattern === 'custom'"
            label="自定义前缀"
          >
            <el-input
              v-model="batchRenameForm.customPrefix"
              placeholder="输入前缀，如: GPIO"
            />
          </el-form-item>
          <el-form-item label="起始编号">
            <el-input-number
              v-model="batchRenameForm.startNumber"
              :min="0"
            />
          </el-form-item>
          <el-form-item label="应用范围">
            <el-checkbox-group v-model="batchRenameForm.scope">
              <el-checkbox label="visible">
                仅显示的通道
              </el-checkbox>
              <el-checkbox label="all">
                所有通道
              </el-checkbox>
            </el-checkbox-group>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="showBatchRename = false">
          取消
        </el-button>
        <el-button
          type="primary"
          @click="applyBatchRename"
        >
          应用
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
  .channel-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 16px;
    overflow: hidden;
  }

  .channel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .channel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .channel-actions {
    display: flex;
    gap: 8px;
  }

  .channel-filters {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .search-input {
    flex: 1;
    max-width: 200px;
  }

  .filter-select {
    width: 120px;
  }

  .channels-container {
    flex: 1;
    overflow-y: auto;
    border: 1px solid #ebeef5;
    border-radius: 4px;
  }

  .no-channels {
    padding: 40px;
    text-align: center;
  }

  .channels-list {
    display: flex;
    flex-direction: column;
  }

  .channel-item {
    border-bottom: 1px solid #ebeef5;
    transition: background-color 0.3s;
  }

  .channel-item.even-row {
    background-color: #fafafa;
  }

  .channel-item.odd-row {
    background-color: #ffffff;
  }

  .channel-item.hidden {
    opacity: 0.5;
  }

  .channel-item.selected {
    border-left: 3px solid #409eff;
    background-color: #f0f9ff;
  }

  .channel-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    cursor: pointer;
    transition: background-color 0.3s;
  }

  .channel-header-row:hover {
    background-color: rgba(64, 158, 255, 0.1);
  }

  .channel-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .channel-visibility .el-button.hidden {
    color: #c0c4cc;
  }

  .channel-number {
    min-width: 40px;
  }

  .channel-label {
    font-weight: 500;
    font-family: monospace;
  }

  .color-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px #ddd;
    transition: transform 0.2s;
  }

  .color-dot:hover {
    transform: scale(1.2);
  }

  .channel-status {
    display: flex;
    gap: 4px;
  }

  .channel-name-row {
    padding: 0 12px 8px 12px;
  }

  .channel-name-input {
    font-size: 12px;
  }

  .channel-details {
    padding: 8px 12px;
    background-color: #f8f9fa;
    border-top: 1px solid #ebeef5;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }

  .detail-label {
    color: #909399;
  }

  .detail-value {
    font-weight: 500;
    font-family: monospace;
  }

  .channel-stats {
    margin-top: 16px;
    padding: 12px;
    background-color: #f5f7fa;
    border-radius: 4px;
  }

  .stats-row {
    display: flex;
    justify-content: space-around;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .stat-label {
    font-size: 12px;
    color: #909399;
  }

  .stat-value {
    font-size: 16px;
    font-weight: 600;
    color: #409eff;
  }

  .color-picker {
    padding: 16px;
  }

  .preset-colors {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }

  .color-item {
    width: 30px;
    height: 30px;
    border-radius: 4px;
    cursor: pointer;
    border: 2px solid transparent;
    transition: border-color 0.3s, transform 0.2s;
  }

  .color-item:hover {
    border-color: #409eff;
    transform: scale(1.1);
  }

  .color-item.selected {
    border-color: #409eff;
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
  }

  .custom-color {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .color-input {
    flex: 1;
  }

  .batch-rename {
    padding: 16px;
  }
</style>
