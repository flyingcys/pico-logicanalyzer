<!--
快捷键帮助对话框
显示所有可用的键盘快捷键和操作提示
-->

<template>
  <el-dialog
    v-model="visible"
    title="键盘快捷键帮助"
    :width="800"
    :modal="true"
    :close-on-click-modal="true"
    :close-on-press-escape="true"
    class="shortcut-help-dialog"
  >
    <div class="help-content">
      <!-- 搜索框 -->
      <div class="search-section">
        <el-input
          v-model="searchText"
          placeholder="搜索快捷键..."
          :prefix-icon="Search"
          clearable
          class="search-input"
        />
      </div>

      <!-- 快捷键分类 -->
      <div class="shortcuts-container">
        <div
          v-for="category in filteredCategories"
          :key="category.name"
          class="category-section"
        >
          <h3 class="category-title">
            <el-icon class="category-icon">
              <component :is="getCategoryIcon(category.name)" />
            </el-icon>
            {{ category.name }}
            <span class="shortcut-count">({{ category.shortcuts.length }})</span>
          </h3>
          
          <div class="shortcuts-grid">
            <div
              v-for="shortcut in category.shortcuts"
              :key="shortcut.id"
              class="shortcut-item"
              :class="{ disabled: !shortcut.enabled }"
            >
              <div class="shortcut-keys">
                <span
                  v-for="(key, index) in shortcut.keys"
                  :key="index"
                  class="key-badge"
                >
                  {{ formatKey(key) }}
                </span>
              </div>
              <div class="shortcut-description">
                {{ shortcut.description }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 没有搜索结果 -->
      <div v-if="filteredCategories.length === 0" class="no-results">
        <el-empty description="未找到匹配的快捷键" :image-size="80" />
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-info">
          <el-icon><InfoFilled /></el-icon>
          <span>提示：在输入框中输入时，快捷键会被暂时禁用</span>
        </div>
        <div class="footer-actions">
          <el-button @click="resetToDefaults">恢复默认</el-button>
          <el-button @click="exportShortcuts">导出配置</el-button>
          <el-button type="primary" @click="closeDialog">关闭</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { Search, InfoFilled, Monitor, Connection, VideoPlay, Document, Grid, Cpu, Setting, QuestionFilled } from '@element-plus/icons-vue';
  import { ElMessage } from 'element-plus';
  import { keyboardShortcutManager, type ShortcutCategory } from '../utils/KeyboardShortcutManager';

  // Props
  interface Props {
    modelValue: boolean;
  }

  const props = defineProps<Props>();

  // Emits
  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
  }>();

  // 响应式数据
  const searchText = ref('');
  const shortcutCategories = ref<ShortcutCategory[]>([]);

  // 计算属性
  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  });

  const filteredCategories = computed(() => {
    if (!searchText.value.trim()) {
      return shortcutCategories.value;
    }

    const searchLower = searchText.value.toLowerCase();
    return shortcutCategories.value
      .map(category => ({
        ...category,
        shortcuts: category.shortcuts.filter(shortcut =>
          shortcut.description.toLowerCase().includes(searchLower) ||
          shortcut.keys.some(key => key.toLowerCase().includes(searchLower)) ||
          category.name.toLowerCase().includes(searchLower)
        )
      }))
      .filter(category => category.shortcuts.length > 0);
  });

  // 方法
  const loadShortcuts = () => {
    shortcutCategories.value = keyboardShortcutManager.getShortcutsByCategory();
  };

  const getCategoryIcon = (categoryName: string) => {
    const iconMap: Record<string, any> = {
      '设备操作': Connection,
      '采集控制': VideoPlay,
      '文件操作': Document,
      '波形操作': Monitor,
      '通道控制': Grid,
      '面板控制': Setting,
      '帮助': QuestionFilled
    };
    
    return iconMap[categoryName] || Cpu;
  };

  const formatKey = (key: string): string => {
    const keyMap: Record<string, string> = {
      'Ctrl': '⌘',
      'Shift': '⇧',
      'Alt': '⌥',
      'Meta': '⌘',
      'ArrowLeft': '←',
      'ArrowRight': '→',
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'F1': 'F1'
    };

    return keyMap[key] || key;
  };

  const resetToDefaults = () => {
    ElMessage.info('重置为默认快捷键配置');
    // 这里可以实现重置逻辑
    loadShortcuts();
  };

  const exportShortcuts = () => {
    try {
      const shortcuts = keyboardShortcutManager.getShortcutsByCategory();
      const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        shortcuts: shortcuts
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'logic-analyzer-shortcuts.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      ElMessage.success('快捷键配置已导出');
    } catch (error) {
      console.error('导出快捷键配置失败:', error);
      ElMessage.error('导出失败');
    }
  };

  const closeDialog = () => {
    visible.value = false;
  };

  // 监听对话框打开，加载快捷键数据
  watch(visible, (newVisible) => {
    if (newVisible) {
      loadShortcuts();
      searchText.value = '';
    }
  });
</script>

<style scoped>
  .shortcut-help-dialog {
    --el-dialog-content-font-size: 14px;
  }

  .help-content {
    max-height: 600px;
    overflow-y: auto;
  }

  .search-section {
    margin-bottom: 24px;
  }

  .search-input {
    width: 100%;
  }

  .shortcuts-container {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .category-section {
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    overflow: hidden;
  }

  .category-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 12px 16px;
    background-color: #f5f7fa;
    border-bottom: 1px solid #e4e7ed;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }

  .category-icon {
    font-size: 18px;
    color: #409eff;
  }

  .shortcut-count {
    font-size: 12px;
    color: #909399;
    font-weight: normal;
  }

  .shortcuts-grid {
    padding: 12px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 12px;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    background-color: #ffffff;
    transition: all 0.2s;
  }

  .shortcut-item:hover {
    border-color: #409eff;
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
  }

  .shortcut-item.disabled {
    opacity: 0.6;
    background-color: #f5f7fa;
  }

  .shortcut-keys {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .key-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 8px;
    background-color: #f0f0f0;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    font-family: monospace;
    color: #595959;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .shortcut-description {
    flex: 1;
    margin-left: 16px;
    color: #606266;
  }

  .no-results {
    text-align: center;
    padding: 40px 0;
  }

  .dialog-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #909399;
  }

  .footer-actions {
    display: flex;
    gap: 12px;
  }

  /* 深色主题支持 */
  @media (prefers-color-scheme: dark) {
    .category-title {
      background-color: #2d2d2d;
      border-bottom-color: #4c4d4f;
      color: #e5eaf3;
    }

    .category-section {
      border-color: #4c4d4f;
    }

    .shortcut-item {
      background-color: #1e1e1e;
      border-color: #4c4d4f;
    }

    .shortcut-item:hover {
      border-color: #409eff;
    }

    .shortcut-item.disabled {
      background-color: #2d2d2d;
    }

    .key-badge {
      background-color: #3a3a3a;
      border-color: #5a5a5a;
      color: #e5eaf3;
    }

    .shortcut-description {
      color: #a8abb2;
    }
  }

  /* 滚动条样式 */
  .help-content::-webkit-scrollbar {
    width: 6px;
  }

  .help-content::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  .help-content::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }

  .help-content::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .shortcuts-grid {
      grid-template-columns: 1fr;
    }

    .shortcut-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .shortcut-description {
      margin-left: 0;
    }

    .dialog-footer {
      flex-direction: column;
      gap: 12px;
      align-items: stretch;
    }

    .footer-actions {
      justify-content: center;
    }
  }
</style>