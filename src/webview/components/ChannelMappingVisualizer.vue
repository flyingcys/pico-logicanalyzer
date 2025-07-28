<!--
通道映射可视化组件
基于 @logicanalyzer/Software 的通道配置界面
提供直观的通道映射管理和冲突检测
-->

<template>
  <div class="channel-mapping-visualizer">
    <!-- 通道映射概览 -->
    <div class="mapping-overview">
      <h4 class="section-title">
        <el-icon><Connection /></el-icon>
        通道映射概览
      </h4>
      
      <div class="channel-grid">
        <div
          v-for="channelIndex in maxChannels"
          :key="channelIndex - 1"
          :class="[
            'channel-slot',
            getChannelSlotClass(channelIndex - 1)
          ]"
          @click="selectChannel(channelIndex - 1)"
        >
          <div class="channel-number">CH{{ channelIndex }}</div>
          <div class="channel-usage">
            <div
              v-for="usage in getChannelUsage(channelIndex - 1)"
              :key="usage.decoderId"
              :class="['usage-indicator', usage.type]"
              :title="`${usage.decoderName}: ${usage.channelName}`"
            >
              {{ usage.channelName }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 解码器映射详情 -->
    <div v-if="decoderMappings.length > 0" class="decoder-mappings">
      <h4 class="section-title">
        <el-icon><Grid /></el-icon>
        解码器映射详情
      </h4>
      
      <div class="decoder-list">
        <div
          v-for="decoder in decoderMappings"
          :key="decoder.id"
          class="decoder-item"
        >
          <div class="decoder-header">
            <div class="decoder-info">
              <span class="decoder-name">{{ decoder.name }}</span>
              <el-tag
                v-if="decoder.hasConflicts"
                type="danger"
                size="small"
              >
                冲突
              </el-tag>
              <el-tag
                v-if="decoder.hasWarnings"
                type="warning"
                size="small"
              >
                警告
              </el-tag>
            </div>
            <div class="decoder-actions">
              <el-button
                size="small"
                :icon="RefreshRight"
                @click="autoAssignChannels(decoder.id)"
                title="自动分配通道"
              />
              <el-button
                size="small"
                :icon="Download"
                @click="exportMapping(decoder.id)"
                title="导出映射"
              />
            </div>
          </div>
          
          <div class="channel-mappings">
            <div
              v-for="channel in decoder.channels"
              :key="channel.id"
              class="channel-mapping-row"
            >
              <div class="channel-info">
                <span class="channel-name">{{ channel.name }}</span>
                <span v-if="channel.required" class="required-indicator">*</span>
                <span class="channel-desc">{{ channel.desc }}</span>
              </div>
              
              <div class="channel-assignment">
                <el-select
                  v-model="decoder.mapping[channel.id]"
                  placeholder="选择通道"
                  size="small"
                  :class="getChannelSelectClass(decoder.id, channel.id)"
                  @change="onMappingChange(decoder.id, channel.id, $event)"
                >
                  <el-option
                    v-for="i in maxChannels"
                    :key="i - 1"
                    :label="`CH${i}`"
                    :value="i - 1"
                    :disabled="isChannelConflicted(decoder.id, i - 1)"
                  >
                    <div class="channel-option">
                      <span>CH{{ i }}</span>
                      <span
                        v-if="getChannelConflictInfo(i - 1).length > 0"
                        class="conflict-info"
                      >
                        ({{ getChannelConflictInfo(i - 1).join(', ') }})
                      </span>
                    </div>
                  </el-option>
                </el-select>
                
                <div
                  v-if="getMappingError(decoder.id, channel.id)"
                  class="mapping-error"
                >
                  <el-icon><WarningFilled /></el-icon>
                  {{ getMappingError(decoder.id, channel.id) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 冲突和警告信息 -->
    <div v-if="conflicts.length > 0 || warnings.length > 0" class="issues-panel">
      <div v-if="conflicts.length > 0" class="conflicts-section">
        <h5 class="issue-title">
          <el-icon class="error-icon"><CircleCloseFilled /></el-icon>
          通道冲突 ({{ conflicts.length }})
        </h5>
        <div class="issue-list">
          <div
            v-for="conflict in conflicts"
            :key="conflict.channelNumber"
            class="issue-item conflict"
          >
            <div class="issue-channel">CH{{ conflict.channelNumber + 1 }}</div>
            <div class="issue-description">
              被多个解码器使用：
              <span
                v-for="(usage, index) in conflict.conflicts"
                :key="usage.decoderId"
                class="conflict-usage"
              >
                {{ usage.decoderName }}({{ usage.channelName }}){{ index < conflict.conflicts.length - 1 ? ', ' : '' }}
              </span>
            </div>
            <div class="issue-actions">
              <el-button
                size="small"
                type="primary"
                @click="resolveConflict(conflict.channelNumber)"
              >
                解决冲突
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="warnings.length > 0" class="warnings-section">
        <h5 class="issue-title">
          <el-icon class="warning-icon"><WarningFilled /></el-icon>
          警告信息 ({{ warnings.length }})
        </h5>
        <div class="issue-list">
          <div
            v-for="warning in warnings"
            :key="warning.id"
            class="issue-item warning"
          >
            <div class="issue-description">{{ warning.message }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作工具栏 -->
    <div class="toolbar">
      <div class="toolbar-section">
        <el-button :icon="RefreshRight" @click="autoAssignAll">
          自动分配全部
        </el-button>
        <el-button :icon="Delete" @click="clearAllMappings" type="danger">
          清空映射
        </el-button>
      </div>
      
      <div class="toolbar-section">
        <el-button :icon="Download" @click="exportAllMappings">
          导出配置
        </el-button>
        <el-button :icon="Upload" @click="showImportDialog = true">
          导入配置
        </el-button>
      </div>
    </div>

    <!-- 导入配置对话框 -->
    <el-dialog v-model="showImportDialog" title="导入通道映射配置" width="600px">
      <div class="import-dialog">
        <el-upload
          ref="uploadRef"
          :before-upload="handleImport"
          :show-file-list="false"
          accept=".json"
          drag
        >
          <div class="upload-content">
            <el-icon class="upload-icon"><UploadFilled /></el-icon>
            <div class="upload-text">点击或拖拽文件到此处上传</div>
            <div class="upload-hint">支持 .json 格式的配置文件</div>
          </div>
        </el-upload>
        
        <div class="import-textarea">
          <el-input
            v-model="importText"
            type="textarea"
            placeholder="或者直接粘贴配置JSON数据..."
            :rows="8"
          />
        </div>
      </div>
      
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmImport" :disabled="!importText.trim()">
          导入
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue';
  import {
    Connection,
    Grid,
    RefreshRight,
    Download,
    Upload,
    UploadFilled,
    Delete,
    WarningFilled,
    CircleCloseFilled
  } from '@element-plus/icons-vue';
  import { ElMessage, ElMessageBox, ElUpload } from 'element-plus';
  import { channelMappingManager } from '../../decoders/ChannelMapping';
  import type { DecoderInfo } from '../../decoders/types';

  // Props
  interface Props {
    decoders: Array<{
      id: string;
      decoderId: string;
      name: string;
      channels: Array<{
        id: string;
        name: string;
        desc: string;
        required?: boolean;
      }>;
      mapping: Record<string, number>;
    }>;
    maxChannels?: number;
  }

  const props = withDefaults(defineProps<Props>(), {
    maxChannels: 24
  });

  // Emits
  const emit = defineEmits<{
    mappingChange: [decoderId: string, mapping: Record<string, number>];
    conflictDetected: [conflicts: any[]];
  }>();

  // Reactive data
  const showImportDialog = ref(false);
  const importText = ref('');
  const uploadRef = ref<InstanceType<typeof ElUpload>>();
  const selectedChannel = ref<number | null>(null);

  // Computed properties
  const decoderMappings = computed(() => {
    return props.decoders.map(decoder => {
      const validation = channelMappingManager.validateChannelMapping(
        decoder as DecoderInfo,
        decoder.mapping,
        [] // 这里需要从父组件传入实际的通道数据
      );
      
      return {
        ...decoder,
        hasConflicts: !validation.isValid,
        hasWarnings: validation.warnings.length > 0,
        validation
      };
    });
  });

  const activeMappings = computed(() => {
    const mappings = new Map();
    for (const decoder of props.decoders) {
      mappings.set(decoder.id, {
        decoderName: decoder.name,
        mapping: decoder.mapping
      });
    }
    return mappings;
  });

  const channelUsage = computed(() => {
    return channelMappingManager.getChannelUsage(activeMappings.value, props.maxChannels);
  });

  const conflicts = computed(() => {
    return channelMappingManager.detectChannelConflicts(activeMappings.value);
  });

  const warnings = computed(() => {
    const allWarnings: Array<{ id: string; message: string }> = [];
    let warningId = 0;
    
    for (const decoder of decoderMappings.value) {
      for (const warning of decoder.validation.warnings) {
        allWarnings.push({
          id: `warning-${warningId++}`,
          message: `${decoder.name}: ${warning}`
        });
      }
    }
    
    return allWarnings;
  });

  // Methods
  const getChannelUsage = (channelIndex: number) => {
    const usage = channelUsage.value[channelIndex];
    return usage ? usage.usedBy.map(u => ({
      ...u,
      type: 'active'
    })) : [];
  };

  const getChannelSlotClass = (channelIndex: number) => {
    const usage = channelUsage.value[channelIndex];
    const hasConflict = conflicts.value.some(c => c.channelNumber === channelIndex);
    
    return {
      'used': usage?.isUsed || false,
      'conflict': hasConflict,
      'selected': selectedChannel.value === channelIndex
    };
  };

  const getChannelSelectClass = (decoderId: string, channelId: string) => {
    const decoder = decoderMappings.value.find(d => d.id === decoderId);
    const channelIndex = decoder?.mapping[channelId];
    
    if (channelIndex !== undefined) {
      const hasConflict = conflicts.value.some(c => c.channelNumber === channelIndex);
      return hasConflict ? 'conflict-select' : '';
    }
    
    return '';
  };

  const getMappingError = (decoderId: string, channelId: string) => {
    const decoder = decoderMappings.value.find(d => d.id === decoderId);
    if (!decoder) return null;
    
    const channelIndex = decoder.mapping[channelId];
    if (channelIndex === undefined) return null;
    
    const conflict = conflicts.value.find(c => c.channelNumber === channelIndex);
    if (conflict) {
      const otherUsages = conflict.conflicts.filter(c => c.decoderId !== decoderId);
      if (otherUsages.length > 0) {
        return `与 ${otherUsages.map(u => u.decoderName).join(', ')} 冲突`;
      }
    }
    
    return null;
  };

  const getChannelConflictInfo = (channelIndex: number) => {
    const usage = channelUsage.value[channelIndex];
    return usage ? usage.usedBy.map(u => `${u.decoderName}:${u.channelName}`) : [];
  };

  const isChannelConflicted = (decoderId: string, channelIndex: number) => {
    const conflict = conflicts.value.find(c => c.channelNumber === channelIndex);
    return conflict && conflict.conflicts.some(c => c.decoderId !== decoderId);
  };

  const selectChannel = (channelIndex: number) => {
    selectedChannel.value = selectedChannel.value === channelIndex ? null : channelIndex;
  };

  const onMappingChange = (decoderId: string, channelId: string, channelIndex: number) => {
    const decoder = props.decoders.find(d => d.id === decoderId);
    if (decoder) {
      const newMapping = { ...decoder.mapping };
      newMapping[channelId] = channelIndex;
      emit('mappingChange', decoderId, newMapping);
      
      // 保存映射
      channelMappingManager.saveChannelMapping(decoderId, decoder.name, newMapping);
    }
  };

  const autoAssignChannels = (decoderId: string) => {
    const decoder = props.decoders.find(d => d.id === decoderId);
    if (!decoder) return;
    
    // 获取其他解码器已使用的通道
    const usedChannels = new Set<number>();
    for (const otherDecoder of props.decoders) {
      if (otherDecoder.id !== decoderId) {
        for (const channelIndex of Object.values(otherDecoder.mapping)) {
          usedChannels.add(channelIndex);
        }
      }
    }
    
    const newMapping = channelMappingManager.autoAssignChannels(
      decoder as DecoderInfo,
      usedChannels,
      props.maxChannels
    );
    
    emit('mappingChange', decoderId, newMapping);
    channelMappingManager.saveChannelMapping(decoderId, decoder.name, newMapping);
    
    ElMessage.success(`${decoder.name} 通道已自动分配`);
  };

  const autoAssignAll = () => {
    let usedChannels = new Set<number>();
    
    for (const decoder of props.decoders) {
      const newMapping = channelMappingManager.autoAssignChannels(
        decoder as DecoderInfo,
        usedChannels,
        props.maxChannels
      );
      
      // 更新已使用的通道
      for (const channelIndex of Object.values(newMapping)) {
        usedChannels.add(channelIndex);
      }
      
      emit('mappingChange', decoder.id, newMapping);
      channelMappingManager.saveChannelMapping(decoder.id, decoder.name, newMapping);
    }
    
    ElMessage.success('所有解码器通道已自动分配');
  };

  const clearAllMappings = async () => {
    try {
      await ElMessageBox.confirm(
        '确定要清空所有通道映射吗？此操作不可恢复。',
        '确认清空',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      );
      
      for (const decoder of props.decoders) {
        emit('mappingChange', decoder.id, {});
      }
      
      ElMessage.success('所有通道映射已清空');
    } catch {
      // 用户取消
    }
  };

  const resolveConflict = (channelNumber: number) => {
    const conflict = conflicts.value.find(c => c.channelNumber === channelNumber);
    if (!conflict) return;
    
    // 简单解决方案：为冲突的解码器重新分配通道
    const usedChannels = new Set<number>();
    
    // 收集所有已使用的通道（除了冲突的那个）
    for (const decoder of props.decoders) {
      for (const [channelId, channelIndex] of Object.entries(decoder.mapping)) {
        if (channelIndex !== channelNumber) {
          usedChannels.add(channelIndex);
        }
      }
    }
    
    // 为每个冲突的解码器重新分配
    for (const conflictInfo of conflict.conflicts.slice(1)) { // 保留第一个，重新分配其他的
      const decoder = props.decoders.find(d => d.id === conflictInfo.decoderId);
      if (decoder) {
        const newMapping = channelMappingManager.autoAssignChannels(
          decoder as DecoderInfo,
          usedChannels,
          props.maxChannels
        );
        
        // 更新已使用的通道
        for (const channelIndex of Object.values(newMapping)) {
          usedChannels.add(channelIndex);
        }
        
        emit('mappingChange', decoder.id, newMapping);
        channelMappingManager.saveChannelMapping(decoder.id, decoder.name, newMapping);
      }
    }
    
    ElMessage.success(`CH${channelNumber + 1} 冲突已解决`);
  };

  const exportMapping = (decoderId: string) => {
    const decoder = props.decoders.find(d => d.id === decoderId);
    if (!decoder) return;
    
    const config = {
      decoderId: decoder.decoderId,
      decoderName: decoder.name,
      mapping: decoder.mapping,
      exportDate: new Date().toISOString()
    };
    
    const jsonData = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${decoder.name}-channel-mapping.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    ElMessage.success(`${decoder.name} 通道映射已导出`);
  };

  const exportAllMappings = () => {
    const jsonData = channelMappingManager.exportMappings();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `channel-mappings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    ElMessage.success('所有通道映射配置已导出');
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      importText.value = e.target?.result as string || '';
    };
    reader.readAsText(file);
    return false; // 阻止自动上传
  };

  const confirmImport = () => {
    if (!importText.value.trim()) {
      ElMessage.error('请选择文件或输入配置数据');
      return;
    }
    
    const result = channelMappingManager.importMappings(importText.value);
    
    if (result.success) {
      ElMessage.success(`成功导入 ${result.imported} 个通道映射配置`);
      showImportDialog.value = false;
      importText.value = '';
      
      // 触发重新加载
      for (const decoder of props.decoders) {
        const savedMapping = channelMappingManager.loadChannelMapping(decoder.decoderId);
        if (savedMapping) {
          emit('mappingChange', decoder.id, savedMapping.mapping);
        }
      }
    } else {
      ElMessage.error(`导入失败: ${result.error}`);
    }
  };

  // Watch for conflicts and emit
  watch(conflicts, (newConflicts) => {
    emit('conflictDetected', newConflicts);
  }, { immediate: true });

  // 生命周期
  onMounted(() => {
    // 加载保存的通道映射
    for (const decoder of props.decoders) {
      const savedMapping = channelMappingManager.loadChannelMapping(decoder.decoderId);
      if (savedMapping) {
        emit('mappingChange', decoder.id, savedMapping.mapping);
      }
    }
  });
</script>

<style scoped>
  .channel-mapping-visualizer {
    padding: 16px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
  }

  .mapping-overview {
    margin-bottom: 24px;
  }

  .channel-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 8px;
    margin-bottom: 16px;
  }

  .channel-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 4px;
    border: 2px solid #e4e7ed;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
    min-height: 60px;
  }

  .channel-slot:hover {
    border-color: #409eff;
  }

  .channel-slot.used {
    border-color: #67c23a;
    background-color: #f0f9ff;
  }

  .channel-slot.conflict {
    border-color: #f56c6c;
    background-color: #fef0f0;
  }

  .channel-slot.selected {
    border-color: #409eff;
    background-color: #ecf5ff;
    box-shadow: 0 0 0 2px #409eff40;
  }

  .channel-number {
    font-weight: 600;
    font-size: 12px;
    margin-bottom: 4px;
  }

  .channel-usage {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
  }

  .usage-indicator {
    font-size: 10px;
    padding: 1px 4px;
    border-radius: 2px;
    background-color: #409eff;
    color: white;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .usage-indicator.active {
    background-color: #67c23a;
  }

  .decoder-mappings {
    margin-bottom: 24px;
  }

  .decoder-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .decoder-item {
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    padding: 16px;
  }

  .decoder-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .decoder-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .decoder-name {
    font-weight: 600;
    font-size: 16px;
  }

  .decoder-actions {
    display: flex;
    gap: 4px;
  }

  .channel-mappings {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .channel-mapping-row {
    display: flex;
    align-items: flex-start;
    gap: 16px;
  }

  .channel-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .channel-name {
    font-weight: 500;
    font-size: 14px;
  }

  .required-indicator {
    color: #f56c6c;
    font-weight: bold;
  }

  .channel-desc {
    font-size: 12px;
    color: #909399;
  }

  .channel-assignment {
    flex: 0 0 200px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .conflict-select {
    border-color: #f56c6c !important;
  }

  .mapping-error {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #f56c6c;
  }

  .channel-option {
    display: flex;
    justify-content: space-between;
    width: 100%;
  }

  .conflict-info {
    font-size: 10px;
    color: #f56c6c;
    font-style: italic;
  }

  .issues-panel {
    margin-bottom: 24px;
  }

  .conflicts-section,
  .warnings-section {
    margin-bottom: 16px;
  }

  .issue-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
  }

  .error-icon {
    color: #f56c6c;
  }

  .warning-icon {
    color: #e6a23c;
  }

  .issue-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .issue-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 6px;
  }

  .issue-item.conflict {
    background-color: #fef0f0;
    border-left: 4px solid #f56c6c;
  }

  .issue-item.warning {
    background-color: #fdf6ec;
    border-left: 4px solid #e6a23c;
  }

  .issue-channel {
    font-weight: 600;
    font-family: monospace;
    min-width: 40px;
  }

  .issue-description {
    flex: 1;
    font-size: 14px;
  }

  .conflict-usage {
    font-weight: 500;
    color: #409eff;
  }

  .issue-actions {
    flex: 0 0 auto;
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 0;
    border-top: 1px solid #e4e7ed;
  }

  .toolbar-section {
    display: flex;
    gap: 8px;
  }

  .import-dialog {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .upload-content {
    text-align: center;
    padding: 20px;
  }

  .upload-icon {
    font-size: 48px;
    color: #c0c4cc;
    margin-bottom: 16px;
  }

  .upload-text {
    font-size: 16px;
    color: #606266;
    margin-bottom: 4px;
  }

  .upload-hint {
    font-size: 12px;
    color: #909399;
  }

  .import-textarea {
    margin-top: 16px;
  }
</style>