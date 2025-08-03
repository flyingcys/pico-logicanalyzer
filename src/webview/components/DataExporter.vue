<template>
  <div class="data-exporter">
    <el-dialog
      v-model="visible"
      title="数据导出"
      width="700px"
      :close-on-click-modal="false"
      @open="onDialogOpen"
      @close="onDialogClose"
    >
      <div class="export-content">
        <!-- 导出类型选择 -->
        <el-card shadow="never" class="export-section">
          <template #header>
            <span>导出类型</span>
          </template>
          
          <el-radio-group v-model="exportType" @change="onExportTypeChange">
            <el-radio-button label="waveform">波形数据</el-radio-button>
            <el-radio-button label="decoder">解码结果</el-radio-button>
            <el-radio-button label="analysis">分析报告</el-radio-button>
            <el-radio-button label="all">完整项目</el-radio-button>
          </el-radio-group>
          
          <div class="export-description">
            <el-alert
              :title="getExportDescription()"
              type="info"
              :closable="false"
              show-icon
            />
          </div>
        </el-card>

        <!-- 导出格式选择 -->
        <el-card shadow="never" class="export-section">
          <template #header>
            <span>导出格式</span>
          </template>
          
          <el-radio-group v-model="exportFormat" class="format-group">
            <div class="format-options">
              <el-radio
                v-for="format in availableFormats"
                :key="format.value"
                :label="format.value"
                :disabled="!format.available"
                class="format-option"
              >
                <div class="format-info">
                  <div class="format-name">
                    <strong>{{ format.name }}</strong>
                    <el-tag v-if="format.recommended" type="success" size="small">推荐</el-tag>
                  </div>
                  <div class="format-description">{{ format.description }}</div>
                </div>
              </el-radio>
            </div>
          </el-radio-group>
        </el-card>

        <!-- 导出选项 -->
        <el-card shadow="never" class="export-section">
          <template #header>
            <span>导出选项</span>
          </template>
          
          <el-form :model="exportOptions" label-width="120px" size="small">
            <!-- 通用选项 -->
            <el-form-item label="文件名" required>
              <el-input
                v-model="exportOptions.filename"
                placeholder="请输入文件名"
                :suffix-icon="Document"
              />
            </el-form-item>
            
            <el-form-item label="时间范围">
              <el-radio-group v-model="exportOptions.timeRange" @change="onTimeRangeChange">
                <el-radio label="all">全部数据</el-radio>
                <el-radio label="visible">可见范围</el-radio>
                <el-radio label="selection">选中区域</el-radio>
                <el-radio label="custom">自定义</el-radio>
              </el-radio-group>
            </el-form-item>
            
            <el-form-item v-if="exportOptions.timeRange === 'custom'" label="自定义范围">
              <div class="custom-range-inputs">
                <el-input-number
                  v-model="exportOptions.customStart"
                  :min="0"
                  :max="totalSamples - 1"
                  placeholder="起始样本"
                  controls-position="right"
                />
                <span class="range-separator">至</span>
                <el-input-number
                  v-model="exportOptions.customEnd"
                  :min="exportOptions.customStart || 0"
                  :max="totalSamples - 1"
                  placeholder="结束样本"
                  controls-position="right"
                />
              </div>
            </el-form-item>
            
            <!-- 波形数据选项 -->
            <template v-if="exportType === 'waveform'">
              <el-form-item label="通道选择">
                <el-checkbox-group v-model="exportOptions.selectedChannels">
                  <el-checkbox
                    v-for="channel in availableChannels"
                    :key="channel.id"
                    :label="channel.id"
                  >
                    {{ channel.name }}
                  </el-checkbox>
                </el-checkbox-group>
              </el-form-item>
              
              <el-form-item label="采样模式">
                <el-radio-group v-model="exportOptions.samplingMode">
                  <el-radio label="original">原始数据</el-radio>
                  <el-radio label="compressed">压缩数据</el-radio>
                  <el-radio label="interpolated">插值数据</el-radio>
                </el-radio-group>
              </el-form-item>
            </template>
            
            <!-- 解码结果选项 -->
            <template v-if="exportType === 'decoder'">
              <el-form-item label="解码器选择">
                <el-checkbox-group v-model="exportOptions.selectedDecoders">
                  <el-checkbox
                    v-for="decoder in availableDecoders"
                    :key="decoder.id"
                    :label="decoder.id"
                  >
                    {{ decoder.name }} ({{ decoder.count }} 个结果)
                  </el-checkbox>
                </el-checkbox-group>
              </el-form-item>
              
              <el-form-item label="包含详情">
                <el-checkbox-group v-model="exportOptions.includeDetails">
                  <el-checkbox label="timestamps">时间戳</el-checkbox>
                  <el-checkbox label="raw_data">原始数据</el-checkbox>
                  <el-checkbox label="annotations">注释信息</el-checkbox>
                  <el-checkbox label="statistics">统计信息</el-checkbox>
                </el-checkbox-group>
              </el-form-item>
            </template>
            
            <!-- 分析报告选项 -->
            <template v-if="exportType === 'analysis'">
              <el-form-item label="报告内容">
                <el-checkbox-group v-model="exportOptions.reportSections">
                  <el-checkbox label="overview">概览信息</el-checkbox>
                  <el-checkbox label="performance">性能分析</el-checkbox>
                  <el-checkbox label="statistics">统计数据</el-checkbox>
                  <el-checkbox label="recommendations">优化建议</el-checkbox>
                  <el-checkbox label="charts">图表数据</el-checkbox>
                </el-checkbox-group>
              </el-form-item>
              
              <el-form-item label="报告格式">
                <el-radio-group v-model="exportOptions.reportFormat">
                  <el-radio label="detailed">详细报告</el-radio>
                  <el-radio label="summary">摘要报告</el-radio>
                  <el-radio label="technical">技术报告</el-radio>
                </el-radio-group>
              </el-form-item>
            </template>
            
            <!-- 高级选项 -->
            <el-form-item label="高级选项">
              <el-checkbox-group v-model="exportOptions.advancedOptions">
                <el-checkbox label="compress">启用压缩</el-checkbox>
                <el-checkbox label="metadata">包含元数据</el-checkbox>
                <el-checkbox label="checksum">添加校验和</el-checkbox>
                <el-checkbox label="split_files">大文件分割</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 预览信息 -->
        <el-card shadow="never" class="export-section">
          <template #header>
            <span>导出预览</span>
          </template>
          
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="导出类型">
              {{ getExportTypeName() }}
            </el-descriptions-item>
            <el-descriptions-item label="文件格式">
              {{ getFormatName() }}
            </el-descriptions-item>
            <el-descriptions-item label="文件名">
              {{ getFullFilename() }}
            </el-descriptions-item>
            <el-descriptions-item label="估计大小">
              {{ getEstimatedSize() }}
            </el-descriptions-item>
            <el-descriptions-item label="数据范围">
              {{ getDataRangeText() }}
            </el-descriptions-item>
            <el-descriptions-item label="包含内容">
              {{ getContentSummary() }}
            </el-descriptions-item>
          </el-descriptions>
          
          <!-- 进度显示 -->
          <div v-if="isExporting" class="export-progress">
            <el-divider>导出进度</el-divider>
            <el-progress
              :percentage="exportProgress"
              :status="exportStatus"
              :stroke-width="8"
            >
              <template #default="{ percentage }">
                <span class="progress-text">{{ exportStatusText }} {{ percentage }}%</span>
              </template>
            </el-progress>
            
            <div class="progress-details">
              <div class="progress-stats">
                <span>已处理: {{ processedItems.toLocaleString() }} 项</span>
                <span>剩余时间: {{ getEstimatedTime() }}</span>
                <span>速度: {{ getProcessingSpeed() }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="visible = false" :disabled="isExporting">
            关闭
          </el-button>
          <el-button @click="resetOptions" :disabled="isExporting">
            重置
          </el-button>
          <el-button @click="previewExport" :disabled="isExporting">
            预览
          </el-button>
          <el-button
            v-if="isExporting"
            type="danger"
            @click="cancelExport"
          >
            取消导出
          </el-button>
          <el-button
            v-else
            type="primary"
            @click="startExport"
            :disabled="!isValidConfiguration"
          >
            开始导出
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 预览对话框 -->
    <el-dialog
      v-model="previewVisible"
      title="导出预览"
      width="800px"
      :close-on-click-modal="false"
    >
      <div class="preview-content">
        <el-tabs v-model="previewTab">
          <el-tab-pane label="数据预览" name="data">
            <div class="data-preview">
              <pre class="preview-text">{{ previewData }}</pre>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="文件结构" name="structure">
            <div class="structure-preview">
              <el-tree
                :data="fileStructure"
                :props="{ children: 'children', label: 'name' }"
                show-checkbox
                node-key="id"
                default-expand-all
              />
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="统计信息" name="stats">
            <div class="stats-preview">
              <el-descriptions :column="2" border>
                <el-descriptions-item
                  v-for="(value, key) in previewStats"
                  :key="key"
                  :label="key"
                >
                  {{ value }}
                </el-descriptions-item>
              </el-descriptions>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
      
      <template #footer>
        <el-button @click="previewVisible = false">关闭</el-button>
        <el-button type="primary" @click="startExportFromPreview">确认导出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Document } from '@element-plus/icons-vue';

// Props
interface Props {
  modelValue: boolean;
  waveformData?: any;
  decoderResults?: Map<string, any>;
  analysisData?: any;
  totalSamples?: number;
  sampleRate?: number;
}

const props = withDefaults(defineProps<Props>(), {
  totalSamples: 0,
  sampleRate: 0
});

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'export-complete': [data: any];
  'export-error': [error: any];
}>();

// 响应式数据
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const exportType = ref('waveform');
const exportFormat = ref('csv');
const isExporting = ref(false);
const exportProgress = ref(0);
const exportStatus = ref<'success' | 'exception' | ''>('');
const exportStatusText = ref('');
const processedItems = ref(0);
const startTime = ref(0);
const currentCancelToken = ref<{ cancelled: boolean } | null>(null);

const previewVisible = ref(false);
const previewTab = ref('data');
const previewData = ref('');
const fileStructure = ref<any[]>([]);
const previewStats = ref<Record<string, any>>({});

// 导出选项
const exportOptions = ref({
  filename: '',
  timeRange: 'all',
  customStart: 0,
  customEnd: 0,
  selectedChannels: [] as number[],
  selectedDecoders: [] as string[],
  samplingMode: 'original',
  includeDetails: ['timestamps', 'annotations'],
  reportSections: ['overview', 'statistics'],
  reportFormat: 'detailed',
  advancedOptions: ['metadata']
});

// 可用格式配置
const formatConfigs = {
  waveform: [
    { 
      value: 'csv', 
      name: 'CSV', 
      description: '逗号分隔值，通用格式',
      available: true,
      recommended: true
    },
    { 
      value: 'json', 
      name: 'JSON', 
      description: 'JavaScript对象表示法，结构化数据',
      available: true,
      recommended: false
    },
    { 
      value: 'lac', 
      name: 'LAC', 
      description: '原生逻辑分析器格式',
      available: true,
      recommended: true
    },
    { 
      value: 'vcd', 
      name: 'VCD', 
      description: '价值变化转储格式，仿真工具兼容',
      available: true,
      recommended: false
    }
  ],
  decoder: [
    { 
      value: 'csv', 
      name: 'CSV', 
      description: '表格格式，易于分析',
      available: true,
      recommended: true
    },
    { 
      value: 'json', 
      name: 'JSON', 
      description: '结构化格式，保留完整信息',
      available: true,
      recommended: false
    },
    { 
      value: 'txt', 
      name: 'Text', 
      description: '纯文本格式，可读性强',
      available: true,
      recommended: false
    }
  ],
  analysis: [
    { 
      value: 'pdf', 
      name: 'PDF', 
      description: '便携文档格式，专业报告',
      available: false,
      recommended: true
    },
    { 
      value: 'html', 
      name: 'HTML', 
      description: '网页格式，交互式报告',
      available: true,
      recommended: true
    },
    { 
      value: 'markdown', 
      name: 'Markdown', 
      description: '标记语言，易于编辑',
      available: true,
      recommended: false
    }
  ],
  all: [
    { 
      value: 'zip', 
      name: 'ZIP压缩包', 
      description: '包含所有数据的压缩文件',
      available: true,
      recommended: true
    },
    { 
      value: 'project', 
      name: '项目文件', 
      description: '可重新导入的项目格式',
      available: true,
      recommended: false
    }
  ]
};

// 计算属性
const availableFormats = computed(() => {
  return formatConfigs[exportType.value] || [];
});

const availableChannels = computed(() => {
  // 模拟通道数据
  return Array.from({ length: 24 }, (_, i) => ({
    id: i,
    name: `CH${i}`,
    enabled: i < 8
  }));
});

const availableDecoders = computed(() => {
  // 从props.decoderResults获取可用解码器
  const decoders: Array<{ id: string; name: string; count: number }> = [];
  
  if (props.decoderResults) {
    props.decoderResults.forEach((results, id) => {
      decoders.push({
        id,
        name: id.toUpperCase(),
        count: Array.isArray(results) ? results.length : 0
      });
    });
  }
  
  return decoders;
});

const isValidConfiguration = computed(() => {
  return exportOptions.value.filename.trim() !== '' && 
         exportFormat.value !== '' &&
         !isExporting.value;
});

// 监听器
watch(exportType, () => {
  // 重置格式选择
  const formats = availableFormats.value;
  if (formats.length > 0) {
    const recommended = formats.find(f => f.recommended);
    exportFormat.value = recommended ? recommended.value : formats[0].value;
  }
  
  // 生成默认文件名
  generateDefaultFilename();
});

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    generateDefaultFilename();
    resetChannelSelection();
    resetDecoderSelection();
  }
});

// 方法
function onDialogOpen(): void {
  generateDefaultFilename();
  resetChannelSelection();
  resetDecoderSelection();
}

async function onDialogClose(): Promise<void> {
  if (isExporting.value) {
    // 弹出确认对话框
    try {
      await ElMessageBox.confirm(
        '导出正在进行中，确定要取消吗？',
        '确认取消',
        {
          confirmButtonText: '取消导出',
          cancelButtonText: '继续导出',
          type: 'warning'
        }
      );
      
      // 用户选择取消导出
      cancelExport();
    } catch {
      // 用户选择继续导出，不关闭对话框
      return;
    }
  }
}

function onExportTypeChange(): void {
  generateDefaultFilename();
}

function onTimeRangeChange(): void {
  if (exportOptions.value.timeRange === 'custom') {
    exportOptions.value.customStart = 0;
    exportOptions.value.customEnd = props.totalSamples - 1;
  }
}

function generateDefaultFilename(): void {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  const typePrefix = {
    waveform: 'waveform',
    decoder: 'decoder_results',
    analysis: 'analysis_report',
    all: 'project'
  }[exportType.value];
  
  exportOptions.value.filename = `${typePrefix}_${timestamp}`;
}

function resetChannelSelection(): void {
  exportOptions.value.selectedChannels = availableChannels.value
    .filter(ch => ch.enabled)
    .map(ch => ch.id);
}

function resetDecoderSelection(): void {
  exportOptions.value.selectedDecoders = availableDecoders.value
    .map(decoder => decoder.id);
}

function resetOptions(): void {
  exportType.value = 'waveform';
  exportFormat.value = 'csv';
  exportOptions.value = {
    filename: '',
    timeRange: 'all',
    customStart: 0,
    customEnd: 0,
    selectedChannels: [],
    selectedDecoders: [],
    samplingMode: 'original',
    includeDetails: ['timestamps', 'annotations'],
    reportSections: ['overview', 'statistics'],
    reportFormat: 'detailed',
    advancedOptions: ['metadata']
  };
  
  generateDefaultFilename();
  resetChannelSelection();
  resetDecoderSelection();
}

async function previewExport(): Promise<void> {
  try {
    // 生成预览数据
    previewData.value = await generatePreviewData();
    fileStructure.value = generateFileStructure();
    previewStats.value = generatePreviewStats();
    
    previewVisible.value = true;
  } catch (error) {
    ElMessage.error('生成预览失败');
    console.error('Preview generation error:', error);
  }
}

async function startExport(): Promise<void> {
  if (!isValidConfiguration.value) {
    ElMessage.warning('请检查导出配置');
    return;
  }
  
  try {
    isExporting.value = true;
    exportProgress.value = 0;
    exportStatus.value = '';
    exportStatusText.value = '准备导出';
    processedItems.value = 0;
    startTime.value = Date.now();
    
    const exportData = await performExport();
    
    exportProgress.value = 100;
    exportStatus.value = 'success';
    exportStatusText.value = '导出完成';
    
    // 触发下载
    downloadExportedData(exportData);
    
    emit('export-complete', {
      type: exportType.value,
      format: exportFormat.value,
      filename: getFullFilename(),
      size: exportData.length
    });
    
    ElMessage.success('导出完成');
    
    // 延迟关闭对话框
    setTimeout(() => {
      visible.value = false;
      isExporting.value = false;
    }, 1000);
    
  } catch (error) {
    exportStatus.value = 'exception';
    exportStatusText.value = '导出失败';
    isExporting.value = false;
    
    emit('export-error', error);
    ElMessage.error('导出失败: ' + (error as Error).message);
  }
}

function startExportFromPreview(): void {
  previewVisible.value = false;
  startExport();
}

function cancelExport(): void {
  if (currentCancelToken.value) {
    currentCancelToken.value.cancelled = true;
  }
  
  exportStatus.value = 'exception';
  exportStatusText.value = '导出已取消';
  isExporting.value = false;
  
  ElMessage.warning('导出已取消');
}

async function performExport(): Promise<string> {
  // 创建取消令牌
  const cancelToken = { cancelled: false };
  currentCancelToken.value = cancelToken;
  
  // 构建导出选项
  const options = {
    filename: exportOptions.value.filename,
    timeRange: exportOptions.value.timeRange as 'all' | 'visible' | 'selection' | 'custom',
    customStart: exportOptions.value.customStart,
    customEnd: exportOptions.value.customEnd,
    selectedChannels: exportOptions.value.selectedChannels,
    selectedDecoders: exportOptions.value.selectedDecoders,
    samplingMode: exportOptions.value.samplingMode as 'original' | 'compressed' | 'interpolated',
    includeDetails: exportOptions.value.includeDetails,
    reportSections: exportOptions.value.reportSections,
    reportFormat: exportOptions.value.reportFormat as 'detailed' | 'summary' | 'technical',
    advancedOptions: exportOptions.value.advancedOptions,
    chunkSize: 10000, // 性能优化
    useStreaming: true, // 启用流式处理
    cancelToken,
    onProgress: (progress: number, message: string) => {
      exportProgress.value = progress;
      exportStatusText.value = message;
      processedItems.value = Math.floor((progress / 100) * getTotalItems());
    }
  };

  try {
    // 动态导入DataExportService
    const { dataExportService } = await import('../../services/DataExportService');
    
    let result;
    
    switch (exportType.value) {
      case 'waveform':
        if (!props.waveformData) {
          throw new Error('没有可用的波形数据');
        }
        result = await dataExportService.exportWaveformData(
          props.waveformData,
          exportFormat.value,
          options
        );
        break;
        
      case 'decoder':
        if (!props.decoderResults) {
          throw new Error('没有可用的解码结果');
        }
        result = await dataExportService.exportDecoderResults(
          props.decoderResults,
          exportFormat.value,
          options
        );
        break;
        
      case 'analysis':
        if (!props.analysisData) {
          throw new Error('没有可用的分析数据');
        }
        result = await dataExportService.exportAnalysisReport(
          props.analysisData,
          exportFormat.value,
          options
        );
        break;
        
      case 'all':
        result = await dataExportService.exportCompleteProject(
          props.waveformData || {},
          props.decoderResults || new Map(),
          props.analysisData || {},
          options
        );
        break;
        
      default:
        throw new Error('不支持的导出类型');
    }
    
    if (!result.success) {
      throw new Error(result.error || '导出失败');
    }
    
    return result.data as string;
    
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}

function generateExportData(): string {
  switch (exportType.value) {
    case 'waveform':
      return generateWaveformData();
    case 'decoder':
      return generateDecoderData();
    case 'analysis':
      return generateAnalysisData();
    case 'all':
      return generateProjectData();
    default:
      return '';
  }
}

function generateWaveformData(): string {
  if (exportFormat.value === 'csv') {
    let csv = 'Time,';
    csv += exportOptions.value.selectedChannels.map(ch => `CH${ch}`).join(',');
    csv += '\n';
    
    // 生成模拟数据
    const sampleCount = Math.min(1000, getTotalItems());
    for (let i = 0; i < sampleCount; i++) {
      const time = (i / props.sampleRate * 1000).toFixed(6); // ms
      csv += time + ',';
      csv += exportOptions.value.selectedChannels.map(() => 
        Math.random() > 0.5 ? '1' : '0'
      ).join(',');
      csv += '\n';
    }
    
    return csv;
  }
  
  // 其他格式的实现...
  return JSON.stringify({ message: '波形数据导出功能开发中' }, null, 2);
}

function generateDecoderData(): string {
  if (exportFormat.value === 'csv') {
    let csv = 'Decoder,Type,StartSample,EndSample,Duration,Value\n';
    
    exportOptions.value.selectedDecoders.forEach(decoderId => {
      const results = props.decoderResults?.get(decoderId) || [];
      if (Array.isArray(results)) {
        results.forEach(result => {
          csv += `"${decoderId}","${result.annotationType}",${result.startSample},${result.endSample},${result.endSample - result.startSample},"${result.values.join(' | ')}"\n`;
        });
      }
    });
    
    return csv;
  }
  
  return JSON.stringify({ message: '解码数据导出功能开发中' }, null, 2);
}

function generateAnalysisData(): string {
  const report = {
    title: '逻辑分析器分析报告',
    timestamp: new Date().toISOString(),
    summary: {
      totalSamples: props.totalSamples,
      sampleRate: props.sampleRate,
      duration: props.totalSamples / props.sampleRate,
      decoders: exportOptions.value.selectedDecoders.length
    },
    sections: exportOptions.value.reportSections
  };
  
  if (exportFormat.value === 'json') {
    return JSON.stringify(report, null, 2);
  }
  
  return JSON.stringify({ message: '分析报告导出功能开发中' }, null, 2);
}

function generateProjectData(): string {
  return JSON.stringify({ message: '项目导出功能开发中' }, null, 2);
}

async function generatePreviewData(): Promise<string> {
  // 生成预览数据的前几行
  const fullData = generateExportData();
  const lines = fullData.split('\n');
  return lines.slice(0, 20).join('\n') + (lines.length > 20 ? '\n...' : '');
}

function generateFileStructure(): any[] {
  const structure = [
    {
      id: '1',
      name: getFullFilename(),
      children: []
    }
  ];
  
  if (exportOptions.value.advancedOptions.includes('metadata')) {
    structure[0].children.push({
      id: '2',
      name: 'metadata.json'
    });
  }
  
  return structure;
}

function generatePreviewStats(): Record<string, any> {
  return {
    '文件数量': '1',
    '估计大小': getEstimatedSize(),
    '数据行数': getTotalItems().toLocaleString(),
    '压缩率': exportOptions.value.advancedOptions.includes('compress') ? '60%' : 'N/A'
  };
}

function downloadExportedData(data: string): void {
  const blob = new Blob([data], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getFullFilename();
  a.click();
  URL.revokeObjectURL(url);
}

// 工具函数
function getExportDescription(): string {
  const descriptions = {
    waveform: '导出原始波形数据，包含时间序列和通道状态信息',
    decoder: '导出协议解码结果，包含解析后的通信数据',
    analysis: '导出性能分析报告，包含统计信息和优化建议',
    all: '导出完整项目数据，包含波形、解码结果和分析报告'
  };
  
  return descriptions[exportType.value] || '';
}

function getExportTypeName(): string {
  const names = {
    waveform: '波形数据',
    decoder: '解码结果',
    analysis: '分析报告',
    all: '完整项目'
  };
  
  return names[exportType.value] || '';
}

function getFormatName(): string {
  const format = availableFormats.value.find(f => f.value === exportFormat.value);
  return format ? format.name : exportFormat.value.toUpperCase();
}

function getFullFilename(): string {
  const format = availableFormats.value.find(f => f.value === exportFormat.value);
  const extension = format?.value || 'txt';
  return `${exportOptions.value.filename}.${extension}`;
}

function getEstimatedSize(): string {
  const baseSize = getTotalItems() * 50; // 估计每项50字节
  const size = Math.max(1024, baseSize);
  
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  } else {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
}

function getDataRangeText(): string {
  switch (exportOptions.value.timeRange) {
    case 'all':
      return '全部数据';
    case 'visible':
      return '可见范围';
    case 'selection':
      return '选中区域';
    case 'custom':
      return `自定义 (${exportOptions.value.customStart}-${exportOptions.value.customEnd})`;
    default:
      return '未知';
  }
}

function getContentSummary(): string {
  const contents = [];
  
  if (exportType.value === 'waveform') {
    contents.push(`${exportOptions.value.selectedChannels.length} 个通道`);
  }
  
  if (exportType.value === 'decoder') {
    contents.push(`${exportOptions.value.selectedDecoders.length} 个解码器`);
  }
  
  if (exportOptions.value.advancedOptions.includes('metadata')) {
    contents.push('元数据');
  }
  
  return contents.join(', ') || '基本数据';
}

function getTotalItems(): number {
  switch (exportType.value) {
    case 'waveform':
      return props.totalSamples || 1000;
    case 'decoder':
      let total = 0;
      exportOptions.value.selectedDecoders.forEach(decoderId => {
        const results = props.decoderResults?.get(decoderId) || [];
        total += Array.isArray(results) ? results.length : 0;
      });
      return total || 100;
    case 'analysis':
      return 50; // 报告行数
    case 'all':
      return (props.totalSamples || 1000) + 100 + 50;
    default:
      return 1000;
  }
}

function getEstimatedTime(): string {
  if (!isExporting.value || exportProgress.value === 0) {
    return 'N/A';
  }
  
  const elapsed = Date.now() - startTime.value;
  const remaining = (elapsed / exportProgress.value) * (100 - exportProgress.value);
  
  if (remaining < 60000) {
    return `${Math.ceil(remaining / 1000)}秒`;
  } else {
    return `${Math.ceil(remaining / 60000)}分钟`;
  }
}

function getProcessingSpeed(): string {
  if (!isExporting.value || exportProgress.value === 0) {
    return 'N/A';
  }
  
  const elapsed = (Date.now() - startTime.value) / 1000;
  const speed = processedItems.value / elapsed;
  
  return `${Math.round(speed)}/秒`;
}
</script>

<style scoped>
.data-exporter {
  /* 样式已内置到对话框中 */
}

.export-content {
  max-height: 70vh;
  overflow-y: auto;
}

.export-section {
  margin-bottom: 16px;
}

.export-description {
  margin-top: 12px;
}

.format-group {
  width: 100%;
}

.format-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.format-option {
  width: 100% !important;
  align-items: flex-start;
  height: auto;
  padding: 12px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  transition: all 0.3s;
}

.format-option:hover {
  border-color: #409eff;
  background-color: #f0f9ff;
}

.format-option.is-checked {
  border-color: #409eff;
  background-color: #f0f9ff;
}

.format-info {
  margin-left: 8px;
  flex: 1;
}

.format-name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.format-description {
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}

.custom-range-inputs {
  display: flex;
  align-items: center;
  gap: 12px;
}

.range-separator {
  color: #666;
}

.export-progress {
  margin-top: 16px;
}

.progress-text {
  font-weight: 500;
}

.progress-details {
  margin-top: 8px;
}

.progress-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
}

.dialog-footer {
  display: flex;
  gap: 8px;
}

.preview-content {
  max-height: 60vh;
  overflow-y: auto;
}

.data-preview {
  background: #f5f5f5;
  border-radius: 4px;
  padding: 12px;
}

.preview-text {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
  margin: 0;
  white-space: pre-wrap;
  max-height: 400px;
  overflow-y: auto;
}

.structure-preview {
  padding: 12px;
}

.stats-preview {
  padding: 12px;
}
</style>