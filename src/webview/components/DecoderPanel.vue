<!--
解码器面板组件
基于 @logicanalyzer/Software 的协议解码器功能
提供解码器列表、搜索、配置和结果显示
-->

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { DataAnalysis, Plus, Setting, Search, Delete, Refresh } from '@element-plus/icons-vue';
  import { ElMessage, ElMessageBox } from 'element-plus';
  import { decoderManager } from '../../decoders/DecoderManager';
  import type { DecoderInfo, DecoderOptionValue, DecoderSelectedChannel, ChannelData } from '../../decoders/types';
  import type { AnalyzerChannel } from '../../models/AnalyzerTypes';

  // 解码器相关接口
  // 使用导入的DecoderInfo类型

  interface ActiveDecoder {
    id: string;
    decoderId: string;
    name: string;
    description: string;
    instanceName: string;
    channelMapping: Record<string, number>;
    options: DecoderOptionValue[];
    results?: Array<{
      startSample: number;
      endSample: number;
      annotationType: number;
      values: string[];
      rawData?: any;
    }>;
    resultCount?: number;
    executionTime?: number;
    status: 'idle' | 'running' | 'completed' | 'error';
    errorMessage?: string;
  }

  // 响应式数据
  const searchQuery = ref('');
  const selectedCategory = ref('');
  const showAddDecoderDialog = ref(false);
  const showDecoderInfoDialog = ref(false);
  const showResultsDialog = ref(false);
  const showDecoderSettings = ref(false);

  const selectedDecoderForAdd = ref<DecoderInfo | null>(null);
  const selectedDecoderForInfo = ref<DecoderInfo | null>(null);
  const selectedDecoderForResults = ref<ActiveDecoder | null>(null);

  const activeDecoders = ref<ActiveDecoder[]>([]);
  const availableDecoders = ref<DecoderInfo[]>([]);

  // 解码器配置表单
  const decoderConfig = ref({
    instanceName: '',
    channelMapping: {} as Record<string, number>,
    options: [] as DecoderOptionValue[]
  });

  // 当前采集的通道数据 - 从父组件获取或从store获取
  const currentChannels = ref<AnalyzerChannel[]>([]);
  const currentSampleRate = ref<number>(1000000); // 默认1MHz

  // 计算属性
  const categories = computed(() => {
    const allTags = availableDecoders.value.flatMap(decoder => decoder.tags);
    return [...new Set(allTags)].sort();
  });

  const filteredDecoders = computed(() => {
    let filtered = availableDecoders.value;

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter(
        decoder =>
          decoder.name.toLowerCase().includes(query) ||
          decoder.description.toLowerCase().includes(query) ||
          decoder.longname.toLowerCase().includes(query) ||
          decoder.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (selectedCategory.value) {
      filtered = filtered.filter(decoder => decoder.tags.includes(selectedCategory.value));
    }

    return filtered;
  });

  const isDecoderConfigValid = computed(() => {
    if (!selectedDecoderForAdd.value) return false;
    if (!decoderConfig.value.instanceName.trim()) return false;

    // 检查必需通道是否都已映射
    const requiredChannels = selectedDecoderForAdd.value.channels.filter(ch => ch.required);
    return requiredChannels.every(ch => decoderConfig.value.channelMapping[ch.id] !== undefined);
  });

  // 方法
  const loadAvailableDecoders = async () => {
    try {
      // 从实际的DecoderManager获取可用解码器
      availableDecoders.value = decoderManager.getAvailableDecoders();
      console.log(`Loaded ${availableDecoders.value.length} available decoders`);
    } catch (error) {
      console.error('Failed to load available decoders:', error);
      ElMessage.error('加载解码器列表失败');
      availableDecoders.value = [];
    }
  };

  const selectDecoder = (decoder: DecoderInfo) => {
    selectedDecoderForAdd.value = decoder;

    // 重置配置
    decoderConfig.value = {
      instanceName: decoder.name,
      channelMapping: {},
      options: []
    };

    // 设置默认选项值
    decoderConfig.value.options = decoder.options.map(option => ({
      id: option.id,
      value: option.default
    }));

    showAddDecoderDialog.value = true;
  };

  const addDecoder = (decoder: DecoderInfo) => {
    selectDecoder(decoder);
  };

  const confirmAddDecoder = () => {
    if (!selectedDecoderForAdd.value) return;

    if (editingDecoderId.value) {
      // 编辑模式：更新现有解码器
      updateDecoderConfig();
    } else {
      // 新增模式：创建新解码器
      const newDecoder: ActiveDecoder = {
        id: `${selectedDecoderForAdd.value.id}_${Date.now()}`,
        decoderId: selectedDecoderForAdd.value.id,
        name: selectedDecoderForAdd.value.name,
        description: selectedDecoderForAdd.value.description,
        instanceName: decoderConfig.value.instanceName,
        channelMapping: { ...decoderConfig.value.channelMapping },
        options: [...decoderConfig.value.options],
        results: [],
        resultCount: 0,
        executionTime: 0,
        status: 'idle'
      };

      activeDecoders.value.push(newDecoder);
      showAddDecoderDialog.value = false;

      ElMessage.success(`解码器 "${newDecoder.instanceName}" 已添加`);

      // 如果有当前通道数据，自动执行解码
      if (currentChannels.value.length > 0) {
        executeDecoder(newDecoder);
      }
    }
  };

  const removeDecoder = async (decoderId: string) => {
    const decoder = activeDecoders.value.find(d => d.id === decoderId);
    if (!decoder) return;

    try {
      await ElMessageBox.confirm(`确定要移除解码器 "${decoder.instanceName}" 吗？`, '确认移除', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      });

      const index = activeDecoders.value.findIndex(d => d.id === decoderId);
      if (index > -1) {
        activeDecoders.value.splice(index, 1);
        ElMessage.success('解码器已移除');
      }
    } catch {
      // 用户取消
    }
  };

  const clearAllDecoders = async () => {
    if (activeDecoders.value.length === 0) return;

    try {
      await ElMessageBox.confirm(
        `确定要移除所有 ${activeDecoders.value.length} 个解码器吗？`,
        '确认清空',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      );

      activeDecoders.value = [];
      ElMessage.success('所有解码器已清空');
    } catch {
      // 用户取消
    }
  };

  const configureDecoder = (decoder: ActiveDecoder) => {
    // 找到对应的解码器信息
    const decoderInfo = availableDecoders.value.find(d => d.id === decoder.decoderId);
    if (!decoderInfo) {
      ElMessage.error('找不到解码器信息');
      return;
    }

    // 设置为编辑模式
    selectedDecoderForAdd.value = decoderInfo;

    // 填充当前配置
    decoderConfig.value = {
      instanceName: decoder.instanceName,
      channelMapping: { ...decoder.channelMapping },
      options: [...decoder.options]
    };

    // 标记为编辑模式
    editingDecoderId.value = decoder.id;
    showAddDecoderDialog.value = true;
  };

  // 添加编辑状态
  const editingDecoderId = ref<string | null>(null);

  const showDecoderInfo = (decoder: DecoderInfo) => {
    selectedDecoderForInfo.value = decoder;
    showDecoderInfoDialog.value = true;
  };

  const showDecoderResults = (decoder: ActiveDecoder) => {
    selectedDecoderForResults.value = decoder;
    showResultsDialog.value = true;
  };

  const getChannelMappingText = (decoder: ActiveDecoder): string => {
    const mappings = Object.entries(decoder.channelMapping);
    return mappings.map(([channel, index]) => `${channel}→CH${index + 1}`).join(', ') || '未配置';
  };

  // 获取解码器状态文本
  const getDecoderStatusText = (status: string): string => {
    switch (status) {
      case 'idle': return '空闲';
      case 'running': return '运行中';
      case 'completed': return '已完成';
      case 'error': return '错误';
      default: return '未知';
    }
  };

  // 获取解码器状态类型
  const getDecoderStatusType = (status: string): string => {
    switch (status) {
      case 'idle': return 'info';
      case 'running': return 'warning';
      case 'completed': return 'success';
      case 'error': return 'danger';
      default: return 'info';
    }
  };

  const getResultTypeText = (annotationType: number): string => {
    // I2C注释类型映射
    const i2cTypes = [
      'Start',
      'Repeat Start',
      'Stop',
      'ACK',
      'NACK',
      'Bit',
      'Addr Read',
      'Addr Write',
      'Data Read',
      'Data Write',
      'Warning'
    ];
    return i2cTypes[annotationType] || `Type ${annotationType}`;
  };

  // 获取选项值的辅助函数
  const getOptionValue = (optionId: string) => {
    const option = decoderConfig.value.options.find(opt => opt.id === optionId);
    return option ? option.value : undefined;
  };

  // 设置选项值的辅助函数
  const setOptionValue = (optionId: string, value: any) => {
    const option = decoderConfig.value.options.find(opt => opt.id === optionId);
    if (option) {
      option.value = value;
    }
  };

  // 取消添加解码器
  const cancelAddDecoder = () => {
    showAddDecoderDialog.value = false;
    editingDecoderId.value = null;
    selectedDecoderForAdd.value = null;
  };

  // 执行解码器
  const executeDecoder = async (decoder: ActiveDecoder) => {
    if (currentChannels.value.length === 0) {
      ElMessage.warning('没有可用的通道数据');
      return;
    }

    decoder.status = 'running';

    try {
      // 创建通道映射
      const channelMapping: DecoderSelectedChannel[] = Object.entries(decoder.channelMapping).map(([channelId, channelIndex]) => ({
        name: channelId,
        channel: channelIndex
      }));

      // 转换通道数据格式
      const channelData: ChannelData[] = currentChannels.value.map((channel, index) => ({
        channelNumber: index,
        samples: channel.samples || new Uint8Array()
      }));

      // 执行解码
      const result = await decoderManager.executeDecoder(
        decoder.decoderId,
        currentSampleRate.value,
        channelData,
        decoder.options,
        channelMapping
      );

      if (result.success) {
        decoder.results = result.results.map(r => ({
          startSample: r.startSample,
          endSample: r.endSample,
          annotationType: r.annotationType,
          values: r.values,
          rawData: r.rawData
        }));
        decoder.resultCount = result.results.length;
        decoder.executionTime = result.executionTime;
        decoder.status = 'completed';

        ElMessage.success(`解码器 "${decoder.instanceName}" 执行完成，产生 ${result.results.length} 个结果`);
      } else {
        decoder.status = 'error';
        decoder.errorMessage = result.error;
        ElMessage.error(`解码器执行失败: ${result.error}`);
      }
    } catch (error) {
      decoder.status = 'error';
      decoder.errorMessage = error instanceof Error ? error.message : '未知错误';
      ElMessage.error(`解码器执行异常: ${decoder.errorMessage}`);
    }
  };

  // 执行所有活跃解码器
  const executeAllDecoders = async () => {
    for (const decoder of activeDecoders.value) {
      await executeDecoder(decoder);
    }
  };

  // 更新解码器配置
  const updateDecoderConfig = () => {
    if (!editingDecoderId.value) {
      confirmAddDecoder();
      return;
    }

    const decoder = activeDecoders.value.find(d => d.id === editingDecoderId.value);
    if (!decoder) {
      ElMessage.error('找不到要更新的解码器');
      return;
    }

    // 更新配置
    decoder.instanceName = decoderConfig.value.instanceName;
    decoder.channelMapping = { ...decoderConfig.value.channelMapping };
    decoder.options = [...decoderConfig.value.options];

    showAddDecoderDialog.value = false;
    editingDecoderId.value = null;

    ElMessage.success(`解码器 "${decoder.instanceName}" 配置已更新`);

    // 重新执行解码
    if (currentChannels.value.length > 0) {
      executeDecoder(decoder);
    }
  };

  // confirmAddDecoder 已在上方定义，这里不需要重复声明

  // 暴露给父组件的方法
  const updateChannelData = (channels: AnalyzerChannel[], sampleRate: number) => {
    currentChannels.value = channels;
    currentSampleRate.value = sampleRate;

    // 自动执行所有活跃解码器
    if (activeDecoders.value.length > 0) {
      executeAllDecoders();
    }
  };

  // 暴露方法给父组件
  defineExpose({
    updateChannelData,
    executeAllDecoders,
    getActiveDecoders: () => activeDecoders.value,
    getDecoderResults: () => {
      const results = new Map<string, any[]>();
      activeDecoders.value.forEach(decoder => {
        if (decoder.results) {
          results.set(decoder.id, decoder.results);
        }
      });
      return results;
    }
  });

  // 生命周期
  onMounted(() => {
    loadAvailableDecoders();
  });

  onUnmounted(() => {
    // 清理资源
    activeDecoders.value = [];
  });
</script>

<template>
  <div class="decoder-panel">
    <!-- 解码器面板头部 -->
    <div class="decoder-header">
      <h3 class="decoder-title">
        <el-icon><DataAnalysis /></el-icon>
        协议解码器
      </h3>
      <div class="decoder-actions">
        <el-button
          type="success"
          :icon="Refresh"
          size="small"
          :disabled="activeDecoders.length === 0 || currentChannels.length === 0"
          title="执行所有解码器"
          @click="executeAllDecoders"
        >
          执行全部
        </el-button>
        <el-button
          type="primary"
          :icon="Plus"
          size="small"
          @click="showAddDecoderDialog = true"
        >
          添加解码器
        </el-button>
        <el-button
          :icon="Setting"
          size="small"
          @click="showDecoderSettings = true"
        >
          设置
        </el-button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <div class="decoder-filters">
      <el-input
        v-model="searchQuery"
        placeholder="搜索解码器..."
        :prefix-icon="Search"
        size="small"
        class="search-input"
        clearable
      />
      <el-select
        v-model="selectedCategory"
        placeholder="选择分类"
        size="small"
        class="category-select"
        clearable
      >
        <el-option
          v-for="category in categories"
          :key="category"
          :label="category"
          :value="category"
        />
      </el-select>
    </div>

    <!-- 活跃解码器列表 -->
    <div
      v-if="activeDecoders.length > 0"
      class="active-decoders"
    >
      <div class="section-header">
        <h4>活跃解码器 ({{ activeDecoders.length }})</h4>
        <el-button
          type="danger"
          size="small"
          @click="clearAllDecoders"
        >
          清空全部
        </el-button>
      </div>

      <div class="decoder-list active">
        <el-card
          v-for="decoder in activeDecoders"
          :key="decoder.id"
          class="decoder-card active-decoder"
          shadow="never"
        >
          <template #header>
            <div class="decoder-card-header">
              <div class="decoder-info">
                <span class="decoder-name">{{ decoder.name }}</span>
                <el-tag
                  :type="getDecoderStatusType(decoder.status)"
                  size="small"
                >
                  {{ getDecoderStatusText(decoder.status) }}
                </el-tag>
              </div>
              <div class="decoder-controls">
                <el-button
                  :icon="Setting"
                  size="small"
                  title="配置"
                  @click="configureDecoder(decoder)"
                />
                <el-button
                  :icon="Refresh"
                  size="small"
                  :loading="decoder.status === 'running'"
                  :disabled="currentChannels.length === 0"
                  title="重新执行"
                  @click="executeDecoder(decoder)"
                />
                <el-button
                  :icon="Delete"
                  size="small"
                  type="danger"
                  @click="removeDecoder(decoder.id)"
                />
              </div>
            </div>
          </template>

          <div class="decoder-content">
            <div class="decoder-description">
              {{ decoder.description }}
            </div>

            <div class="decoder-stats">
              <div class="stat-item">
                <span class="stat-label">通道映射:</span>
                <span class="stat-value">{{ getChannelMappingText(decoder) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">结果数量:</span>
                <span class="stat-value">{{ decoder.resultCount || 0 }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">状态:</span>
                <el-tag
                  :type="getDecoderStatusType(decoder.status)"
                  size="small"
                >
                  {{ getDecoderStatusText(decoder.status) }}
                </el-tag>
              </div>
              <div class="stat-item">
                <span class="stat-label">执行时间:</span>
                <span class="stat-value">{{ decoder.executionTime || 0 }}ms</span>
              </div>
            </div>

            <div
              v-if="decoder.errorMessage"
              class="decoder-error"
            >
              <el-alert
                :title="decoder.errorMessage"
                type="error"
                :closable="false"
                show-icon
                size="small"
              />
            </div>

            <div
              v-if="decoder.results && decoder.results.length > 0"
              class="decoder-results-preview"
            >
              <div class="results-header">
                <span>最近结果:</span>
                <el-button
                  size="small"
                  type="primary"
                  text
                  @click="showDecoderResults(decoder)"
                >
                  查看全部
                </el-button>
              </div>
              <div class="results-list">
                <div
                  v-for="(result, index) in decoder.results.slice(0, 3)"
                  :key="index"
                  class="result-item"
                >
                  <span class="result-type">{{ getResultTypeText(result.annotationType) }}</span>
                  <span class="result-value">{{ result.values[0] }}</span>
                  <span class="result-samples">@ {{ result.startSample }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 可用解码器列表 -->
    <div class="available-decoders">
      <div class="section-header">
        <h4>可用解码器 ({{ filteredDecoders.length }})</h4>
      </div>

      <div
        v-if="filteredDecoders.length === 0"
        class="no-decoders"
      >
        <el-empty
          :image-size="60"
          description="未找到匹配的解码器"
        />
      </div>

      <div
        v-else
        class="decoder-grid"
      >
        <el-card
          v-for="decoder in filteredDecoders"
          :key="decoder.id"
          class="decoder-card available-decoder"
          shadow="hover"
          @click="selectDecoder(decoder)"
        >
          <div class="decoder-card-content">
            <div class="decoder-header-info">
              <h4 class="decoder-name">
                {{ decoder.name }}
              </h4>
              <div class="decoder-badges">
                <el-tag
                  v-for="tag in decoder.tags.slice(0, 2)"
                  :key="tag"
                  size="small"
                  type="info"
                >
                  {{ tag }}
                </el-tag>
              </div>
            </div>

            <p class="decoder-description">
              {{ decoder.description }}
            </p>

            <div class="decoder-details">
              <div class="detail-item">
                <span class="detail-label">输入:</span>
                <span class="detail-value">{{ decoder.inputs.join(', ') }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">输出:</span>
                <span class="detail-value">{{ decoder.outputs.join(', ') }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">通道:</span>
                <span class="detail-value">{{ decoder.channels.length }}个</span>
              </div>
            </div>

            <div class="decoder-actions-row">
              <el-button
                type="primary"
                size="small"
                @click.stop="addDecoder(decoder)"
              >
                添加
              </el-button>
              <el-button
                size="small"
                @click.stop="showDecoderInfo(decoder)"
              >
                详情
              </el-button>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 添加解码器对话框 -->
    <el-dialog
      v-model="showAddDecoderDialog"
      title="添加解码器"
      width="600px"
    >
      <div
        v-if="selectedDecoderForAdd"
        class="add-decoder-form"
      >
        <div class="decoder-info-section">
          <h4>{{ selectedDecoderForAdd.name }}</h4>
          <p>{{ selectedDecoderForAdd.description }}</p>
        </div>

        <el-form
          :model="decoderConfig"
          label-width="100px"
        >
          <el-form-item label="实例名称">
            <el-input
              v-model="decoderConfig.instanceName"
              placeholder="输入解码器实例名称"
            />
          </el-form-item>

          <!-- 通道映射 -->
          <div class="channel-mapping-section">
            <h5>通道映射</h5>
            <div class="channel-mappings">
              <div
                v-for="channel in selectedDecoderForAdd.channels"
                :key="channel.id"
                class="channel-mapping"
              >
                <label class="channel-label">
                  {{ channel.name }}
                  <span
                    v-if="channel.required"
                    class="required"
                  >*</span>
                  <span class="channel-desc">{{ channel.desc }}</span>
                </label>
                <el-select
                  v-model="decoderConfig.channelMapping[channel.id]"
                  placeholder="选择通道"
                  size="small"
                >
                  <el-option
                    v-for="i in 24"
                    :key="i"
                    :label="`Channel ${i}`"
                    :value="i - 1"
                  />
                </el-select>
              </div>
            </div>
          </div>

          <!-- 解码器选项 -->
          <div
            v-if="selectedDecoderForAdd.options.length > 0"
            class="decoder-options-section"
          >
            <h5>解码器选项</h5>
            <div class="decoder-options">
              <el-form-item
                v-for="option in selectedDecoderForAdd.options"
                :key="option.id"
                :label="option.desc"
              >
                <el-input
                  v-if="option.type === 'string'"
                  :model-value="getOptionValue(option.id)"
                  :placeholder="option.default?.toString()"
                  size="small"
                  @update:model-value="(value) => setOptionValue(option.id, value)"
                />
                <el-input-number
                  v-else-if="option.type === 'int' || option.type === 'float'"
                  :model-value="getOptionValue(option.id)"
                  :placeholder="option.default?.toString()"
                  size="small"
                  @update:model-value="(value) => setOptionValue(option.id, value)"
                />
                <el-switch
                  v-else-if="option.type === 'bool'"
                  :model-value="getOptionValue(option.id)"
                  size="small"
                  @update:model-value="(value) => setOptionValue(option.id, value)"
                />
                <el-select
                  v-else-if="option.type === 'list'"
                  :model-value="getOptionValue(option.id)"
                  :placeholder="option.default?.toString()"
                  size="small"
                  @update:model-value="(value) => setOptionValue(option.id, value)"
                >
                  <el-option
                    v-for="value in option.values"
                    :key="value"
                    :label="value"
                    :value="value"
                  />
                </el-select>
              </el-form-item>
            </div>
          </div>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="cancelAddDecoder">
          取消
        </el-button>
        <el-button
          type="primary"
          :disabled="!isDecoderConfigValid"
          @click="confirmAddDecoder"
        >
          {{ editingDecoderId ? '更新' : '添加' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 解码器详情对话框 -->
    <el-dialog
      v-model="showDecoderInfoDialog"
      :title="selectedDecoderForInfo?.name || '解码器详情'"
      width="700px"
    >
      <div
        v-if="selectedDecoderForInfo"
        class="decoder-detail"
      >
        <el-tabs>
          <el-tab-pane
            label="基本信息"
            name="basic"
          >
            <el-descriptions
              :column="2"
              border
            >
              <el-descriptions-item label="解码器名称">
                {{ selectedDecoderForInfo.name }}
              </el-descriptions-item>
              <el-descriptions-item label="完整名称">
                {{ selectedDecoderForInfo.longname }}
              </el-descriptions-item>
              <el-descriptions-item label="许可证">
                {{ selectedDecoderForInfo.license }}
              </el-descriptions-item>
              <el-descriptions-item label="标签">
                <el-tag
                  v-for="tag in selectedDecoderForInfo.tags"
                  :key="tag"
                  size="small"
                  class="tag-item"
                >
                  {{ tag }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item
                label="输入类型"
                span="2"
              >
                {{ selectedDecoderForInfo.inputs.join(', ') }}
              </el-descriptions-item>
              <el-descriptions-item
                label="输出类型"
                span="2"
              >
                {{ selectedDecoderForInfo.outputs.join(', ') }}
              </el-descriptions-item>
            </el-descriptions>
          </el-tab-pane>

          <el-tab-pane
            label="通道定义"
            name="channels"
          >
            <el-table
              :data="selectedDecoderForInfo.channels"
              border
            >
              <el-table-column
                prop="name"
                label="通道名称"
                width="120"
              />
              <el-table-column
                prop="id"
                label="标识符"
                width="100"
              />
              <el-table-column
                label="是否必需"
                width="100"
              >
                <template #default="{ row }">
                  <el-tag
                    :type="row.required ? 'danger' : 'info'"
                    size="small"
                  >
                    {{ row.required ? '必需' : '可选' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column
                prop="desc"
                label="描述"
              />
            </el-table>
          </el-tab-pane>

          <el-tab-pane
            label="配置选项"
            name="options"
          >
            <el-table
              :data="selectedDecoderForInfo.options"
              border
            >
              <el-table-column
                prop="id"
                label="选项ID"
                width="120"
              />
              <el-table-column
                prop="desc"
                label="描述"
              />
              <el-table-column
                prop="type"
                label="类型"
                width="80"
              />
              <el-table-column
                label="默认值"
                width="120"
              >
                <template #default="{ row }">
                  {{ row.default?.toString() || '-' }}
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-dialog>

    <!-- 解码器结果对话框 -->
    <el-dialog
      v-model="showResultsDialog"
      :title="`${selectedDecoderForResults?.name || ''} - 解码结果`"
      width="800px"
    >
      <div
        v-if="selectedDecoderForResults?.results"
        class="decoder-results"
      >
        <div class="results-stats">
          <el-statistic
            title="总结果数"
            :value="selectedDecoderForResults.results.length"
          />
          <el-statistic
            title="执行时间"
            :value="selectedDecoderForResults.executionTime"
            suffix="ms"
          />
        </div>

        <el-table
          :data="selectedDecoderForResults.results"
          border
          max-height="400"
          size="small"
        >
          <el-table-column
            prop="startSample"
            label="开始样本"
            width="100"
          />
          <el-table-column
            prop="endSample"
            label="结束样本"
            width="100"
          />
          <el-table-column
            label="类型"
            width="120"
          >
            <template #default="{ row }">
              {{ getResultTypeText(row.annotationType) }}
            </template>
          </el-table-column>
          <el-table-column
            label="值"
            min-width="200"
          >
            <template #default="{ row }">
              {{ row.values.join(' | ') }}
            </template>
          </el-table-column>
          <el-table-column
            label="原始数据"
            width="100"
          >
            <template #default="{ row }">
              {{ row.rawData !== undefined ? `0x${row.rawData.toString(16).toUpperCase()}` : '-' }}
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
  .decoder-panel {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
  }

  .decoder-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .decoder-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .decoder-actions {
    display: flex;
    gap: 8px;
  }

  .decoder-filters {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .search-input {
    flex: 1;
    max-width: 300px;
  }

  .category-select {
    width: 150px;
  }

  .active-decoders {
    margin-bottom: 24px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .section-header h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .decoder-list.active {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .decoder-card {
    transition: all 0.3s ease;
  }

  .decoder-card.active-decoder {
    border-color: #67c23a;
  }

  .decoder-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .decoder-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .decoder-name {
    font-weight: 600;
    margin: 0;
  }

  .decoder-controls {
    display: flex;
    gap: 4px;
  }

  .decoder-content {
    margin-top: 12px;
  }

  .decoder-description {
    color: #606266;
    margin-bottom: 12px;
  }

  .decoder-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 8px;
    margin-bottom: 12px;
  }

  .stat-item {
    display: flex;
    justify-content: space-between;
  }

  .stat-label {
    color: #909399;
    font-size: 14px;
  }

  .stat-value {
    font-weight: 500;
    font-size: 14px;
  }

  .decoder-results-preview {
    border-top: 1px solid #ebeef5;
    padding-top: 12px;
  }

  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .result-item {
    display: flex;
    gap: 12px;
    padding: 4px 8px;
    background: #f5f7fa;
    border-radius: 4px;
    font-size: 13px;
  }

  .result-type {
    font-weight: 500;
    color: #409eff;
    min-width: 80px;
  }

  .result-value {
    flex: 1;
    font-family: monospace;
  }

  .result-samples {
    color: #909399;
    font-family: monospace;
  }

  .available-decoders {
    margin-top: 24px;
  }

  .no-decoders {
    text-align: center;
    padding: 40px;
  }

  .decoder-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }

  .decoder-card.available-decoder:hover {
    cursor: pointer;
    border-color: #409eff;
  }

  .decoder-card-content {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .decoder-header-info {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .decoder-badges {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .decoder-details {
    margin: 12px 0;
    font-size: 14px;
  }

  .detail-item {
    display: flex;
    gap: 8px;
    margin-bottom: 4px;
  }

  .detail-label {
    color: #909399;
    min-width: 50px;
  }

  .detail-value {
    font-family: monospace;
  }

  .decoder-actions-row {
    display: flex;
    gap: 8px;
    margin-top: auto;
    padding-top: 12px;
  }

  .add-decoder-form {
    max-height: 60vh;
    overflow-y: auto;
  }

  .decoder-info-section {
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #ebeef5;
  }

  .decoder-info-section h4 {
    margin: 0 0 8px 0;
  }

  .channel-mapping-section,
  .decoder-options-section {
    margin-top: 20px;
  }

  .channel-mapping-section h5,
  .decoder-options-section h5 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
  }

  .channel-mappings {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .channel-mapping {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .channel-label {
    flex: 1;
    font-size: 14px;
  }

  .channel-label .required {
    color: #f56c6c;
  }

  .channel-label .channel-desc {
    display: block;
    color: #909399;
    font-size: 12px;
    margin-top: 2px;
  }

  .decoder-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .decoder-detail {
    max-height: 60vh;
    overflow-y: auto;
  }

  .tag-item {
    margin-right: 4px;
  }

  .decoder-results {
    max-height: 60vh;
    overflow-y: auto;
  }

  .results-stats {
    display: flex;
    gap: 20px;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid #ebeef5;
  }

  .decoder-error {
    margin-bottom: 12px;
  }
</style>
