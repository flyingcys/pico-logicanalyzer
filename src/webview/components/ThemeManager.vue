<!--
主题管理器组件
提供主题切换、响应式布局和外观自定义功能
-->

<template>
  <div class="theme-manager">
    <!-- 主题切换控制面板 -->
    <div class="theme-controls">
      <el-card shadow="never" class="control-card">
        <template #header>
          <div class="card-header">
            <span>外观设置</span>
            <el-button size="small" @click="resetToDefaults">重置默认</el-button>
          </div>
        </template>

        <div class="theme-options">
          <!-- 主题模式选择 -->
          <div class="option-group">
            <h4>主题模式</h4>
            <el-radio-group v-model="currentTheme" @change="applyTheme">
              <el-radio-button label="light">浅色</el-radio-button>
              <el-radio-button label="dark">深色</el-radio-button>
              <el-radio-button label="auto">自动</el-radio-button>
            </el-radio-group>
          </div>

          <!-- 主色调设置 -->
          <div class="option-group">
            <h4>主色调</h4>
            <div class="color-picker-group">
              <div class="preset-colors">
                <div
                  v-for="color in presetColors"
                  :key="color.name"
                  class="color-option"
                  :class="{ active: currentPrimaryColor === color.value }"
                  :style="{ backgroundColor: color.value }"
                  @click="setPrimaryColor(color.value)"
                  :title="color.name"
                />
              </div>
              <el-color-picker
                v-model="currentPrimaryColor"
                @change="setPrimaryColor"
                show-alpha
                :predefine="presetColors.map(c => c.value)"
              />
            </div>
          </div>

          <!-- 字体大小设置 -->
          <div class="option-group">
            <h4>字体大小</h4>
            <el-slider
              v-model="fontSize"
              :min="12"
              :max="20"
              :step="1"
              show-stops
              @change="applyFontSize"
            />
            <div class="font-size-info">
              <span class="font-label">当前: {{ fontSize }}px</span>
              <span class="font-preview" :style="{ fontSize: fontSize + 'px' }">
                预览文字 Sample Text
              </span>
            </div>
          </div>

          <!-- 布局密度设置 -->
          <div class="option-group">
            <h4>界面密度</h4>
            <el-radio-group v-model="layoutDensity" @change="applyLayoutDensity">
              <el-radio-button label="compact">紧凑</el-radio-button>
              <el-radio-button label="default">默认</el-radio-button>
              <el-radio-button label="comfortable">宽松</el-radio-button>
            </el-radio-group>
          </div>

          <!-- 组件尺寸设置 -->
          <div class="option-group">
            <h4>组件尺寸</h4>
            <el-radio-group v-model="componentSize" @change="applyComponentSize">
              <el-radio-button label="small">小</el-radio-button>
              <el-radio-button label="default">默认</el-radio-button>
              <el-radio-button label="large">大</el-radio-button>
            </el-radio-group>
          </div>

          <!-- 动画效果设置 -->
          <div class="option-group">
            <h4>动画效果</h4>
            <div class="animation-controls">
              <el-switch
                v-model="animationsEnabled"
                @change="applyAnimationSettings"
                active-text="启用动画"
                inactive-text="禁用动画"
              />
              <el-slider
                v-if="animationsEnabled"
                v-model="animationSpeed"
                :min="0.5"
                :max="2"
                :step="0.1"
                show-input
                show-input-controls
                @change="applyAnimationSettings"
                style="margin-top: 8px"
              />
              <span v-if="animationsEnabled" class="speed-label">
                动画速度: {{ animationSpeed }}x
              </span>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 响应式布局设置 -->
      <el-card shadow="never" class="control-card">
        <template #header>
          <span>布局设置</span>
        </template>

        <div class="layout-options">
          <!-- 侧边栏设置 -->
          <div class="option-group">
            <h4>侧边栏</h4>
            <div class="sidebar-controls">
              <el-checkbox
                v-model="sidebarSettings.leftVisible"
                @change="applySidebarSettings"
              >
                显示左侧栏
              </el-checkbox>
              <el-checkbox
                v-model="sidebarSettings.rightVisible"
                @change="applySidebarSettings"
              >
                显示右侧栏
              </el-checkbox>
              <el-checkbox
                v-model="sidebarSettings.collapsible"
                @change="applySidebarSettings"
              >
                可折叠
              </el-checkbox>
            </div>
            <div class="sidebar-width">
              <span class="width-label">侧栏宽度:</span>
              <el-input-number
                v-model="sidebarSettings.width"
                :min="200"
                :max="500"
                :step="20"
                size="small"
                @change="applySidebarSettings"
              />
              <span class="unit">px</span>
            </div>
          </div>

          <!-- 工具栏设置 -->
          <div class="option-group">
            <h4>工具栏</h4>
            <div class="toolbar-controls">
              <el-checkbox
                v-model="toolbarSettings.showIcons"
                @change="applyToolbarSettings"
              >
                显示图标
              </el-checkbox>
              <el-checkbox
                v-model="toolbarSettings.showText"
                @change="applyToolbarSettings"
              >
                显示文字
              </el-checkbox>
              <el-select
                v-model="toolbarSettings.position"
                size="small"
                @change="applyToolbarSettings"
                style="width: 120px; margin-top: 8px"
              >
                <el-option label="顶部" value="top" />
                <el-option label="底部" value="bottom" />
                <el-option label="左侧" value="left" />
                <el-option label="右侧" value="right" />
              </el-select>
            </div>
          </div>

          <!-- 响应式断点 -->
          <div class="option-group">
            <h4>响应式断点</h4>
            <div class="breakpoint-info">
              <div class="current-breakpoint">
                <span class="breakpoint-label">当前:</span>
                <el-tag :type="getBreakpointType(currentBreakpoint)">
                  {{ getBreakpointName(currentBreakpoint) }}
                </el-tag>
                <span class="viewport-size">{{ viewportWidth }}px</span>
              </div>
              <div class="breakpoint-list">
                <div
                  v-for="bp in breakpoints"
                  :key="bp.name"
                  class="breakpoint-item"
                  :class="{ active: currentBreakpoint === bp.name }"
                >
                  <span class="bp-name">{{ bp.label }}</span>
                  <span class="bp-range">{{ bp.min }}px+</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 自定义CSS -->
      <el-card shadow="never" class="control-card">
        <template #header>
          <div class="card-header">
            <span>自定义样式</span>
            <div class="css-actions">
              <el-button size="small" @click="loadCustomCSS">导入</el-button>
              <el-button size="small" @click="saveCustomCSS">导出</el-button>
            </div>
          </div>
        </template>

        <div class="custom-css">
          <el-input
            v-model="customCSS"
            type="textarea"
            :rows="8"
            placeholder="输入自定义CSS规则..."
            @change="applyCustomCSS"
          />
          <div class="css-help">
            <el-button type="text" size="small" @click="showCSSHelp">
              查看CSS变量参考
            </el-button>
          </div>
        </div>
      </el-card>
    </div>

    <!-- CSS变量参考对话框 -->
    <el-dialog v-model="showCSSReference" title="CSS变量参考" width="600px">
      <div class="css-reference">
        <el-collapse>
          <el-collapse-item title="颜色变量" name="colors">
            <div class="var-list">
              <div v-for="varName in colorVariables" :key="varName" class="var-item">
                <code>{{ varName }}</code>
                <div
                  class="var-preview"
                  :style="{ backgroundColor: `var(${varName})` }"
                />
              </div>
            </div>
          </el-collapse-item>
          <el-collapse-item title="尺寸变量" name="sizes">
            <div class="var-list">
              <div v-for="varName in sizeVariables" :key="varName" class="var-item">
                <code>{{ varName }}</code>
                <span class="var-value">{{ getCSSVariableValue(varName) }}</span>
              </div>
            </div>
          </el-collapse-item>
          <el-collapse-item title="字体变量" name="fonts">
            <div class="var-list">
              <div v-for="varName in fontVariables" :key="varName" class="var-item">
                <code>{{ varName }}</code>
                <span class="var-value">{{ getCSSVariableValue(varName) }}</span>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { ElMessage } from 'element-plus';

  // 接口定义
  interface PresetColor {
    name: string;
    value: string;
  }

  interface SidebarSettings {
    leftVisible: boolean;
    rightVisible: boolean;
    collapsible: boolean;
    width: number;
  }

  interface ToolbarSettings {
    showIcons: boolean;
    showText: boolean;
    position: 'top' | 'bottom' | 'left' | 'right';
  }

  interface Breakpoint {
    name: string;
    label: string;
    min: number;
  }

  // Emits
  const emit = defineEmits<{
    'theme-changed': [theme: string];
    'layout-changed': [layout: any];
    'primary-color-changed': [color: string];
  }>();

  // 响应式数据
  const currentTheme = ref('auto');
  const currentPrimaryColor = ref('#409eff');
  const fontSize = ref(14);
  const layoutDensity = ref('default');
  const componentSize = ref('default');
  const animationsEnabled = ref(true);
  const animationSpeed = ref(1);
  const customCSS = ref('');
  const showCSSReference = ref(false);

  const viewportWidth = ref(window.innerWidth);
  const currentBreakpoint = ref('lg');

  const sidebarSettings = ref<SidebarSettings>({
    leftVisible: true,
    rightVisible: true,
    collapsible: true,
    width: 300
  });

  const toolbarSettings = ref<ToolbarSettings>({
    showIcons: true,
    showText: true,
    position: 'top'
  });

  // 预设颜色
  const presetColors = ref<PresetColor[]>([
    { name: '默认蓝', value: '#409eff' },
    { name: '成功绿', value: '#67c23a' },
    { name: '警告橙', value: '#e6a23c' },
    { name: '危险红', value: '#f56c6c' },
    { name: '信息灰', value: '#909399' },
    { name: '深蓝', value: '#1890ff' },
    { name: '紫色', value: '#722ed1' },
    { name: '青色', value: '#13c2c2' },
    { name: '粉色', value: '#eb2f96' },
    { name: '橘色', value: '#fa8c16' },
    { name: '石墨', value: '#434343' },
    { name: '靛青', value: '#2f54eb' }
  ]);

  // 响应式断点
  const breakpoints = ref<Breakpoint[]>([
    { name: 'xs', label: '超小屏', min: 0 },
    { name: 'sm', label: '小屏', min: 768 },
    { name: 'md', label: '中屏', min: 992 },
    { name: 'lg', label: '大屏', min: 1200 },
    { name: 'xl', label: '超大屏', min: 1920 }
  ]);

  // CSS变量参考
  const colorVariables = ref([
    '--el-color-primary',
    '--el-color-success',
    '--el-color-warning',
    '--el-color-danger',
    '--el-color-info',
    '--el-bg-color',
    '--el-text-color-primary',
    '--el-text-color-regular',
    '--el-border-color',
    '--el-fill-color-blank'
  ]);

  const sizeVariables = ref([
    '--el-component-size',
    '--el-border-radius-base',
    '--el-border-width',
    '--el-font-size-base',
    '--el-font-size-small',
    '--el-font-size-large'
  ]);

  const fontVariables = ref([
    '--el-font-family',
    '--el-font-size-base',
    '--el-font-weight-primary',
    '--el-line-height-primary'
  ]);

  // 计算属性
  const systemTheme = computed(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const effectiveTheme = computed(() => {
    return currentTheme.value === 'auto' ? systemTheme.value : currentTheme.value;
  });

  // 方法
  const applyTheme = (theme: string) => {
    const htmlElement = document.documentElement;
    
    // 移除现有主题类
    htmlElement.classList.remove('theme-light', 'theme-dark');
    
    // 应用新主题
    const effectiveThemeValue = theme === 'auto' ? systemTheme.value : theme;
    htmlElement.classList.add(`theme-${effectiveThemeValue}`);
    
    // 设置CSS变量
    if (effectiveThemeValue === 'dark') {
      htmlElement.style.setProperty('--el-bg-color', '#1d1e1f');
      htmlElement.style.setProperty('--el-text-color-primary', '#e5eaf3');
      htmlElement.style.setProperty('--el-text-color-regular', '#cfd3dc');
      htmlElement.style.setProperty('--el-border-color', '#414243');
      htmlElement.style.setProperty('--el-fill-color-blank', '#2b2b2c');
    } else {
      htmlElement.style.setProperty('--el-bg-color', '#ffffff');
      htmlElement.style.setProperty('--el-text-color-primary', '#303133');
      htmlElement.style.setProperty('--el-text-color-regular', '#606266');
      htmlElement.style.setProperty('--el-border-color', '#dcdfe6');
      htmlElement.style.setProperty('--el-fill-color-blank', '#ffffff');
    }

    emit('theme-changed', effectiveThemeValue);
    saveSettings();
  };

  const setPrimaryColor = (color: string) => {
    currentPrimaryColor.value = color;
    
    // 应用主色调
    const htmlElement = document.documentElement;
    htmlElement.style.setProperty('--el-color-primary', color);
    
    // 生成相关颜色变体
    const lighten = (color: string, amount: number) => {
      // 简化的颜色变亮算法
      const hex = color.replace('#', '');
      const num = parseInt(hex, 16);
      const r = (num >> 16) + amount;
      const g = (num >> 8 & 0x00FF) + amount;
      const b = (num & 0x0000FF) + amount;
      return `#${((r < 255 ? r : 255) << 16 | (g < 255 ? g : 255) << 8 | (b < 255 ? b : 255)).toString(16).padStart(6, '0')}`;
    };

    const darken = (color: string, amount: number) => {
      const hex = color.replace('#', '');
      const num = parseInt(hex, 16);
      const r = (num >> 16) - amount;
      const g = (num >> 8 & 0x00FF) - amount;
      const b = (num & 0x0000FF) - amount;
      return `#${((r > 0 ? r : 0) << 16 | (g > 0 ? g : 0) << 8 | (b > 0 ? b : 0)).toString(16).padStart(6, '0')}`;
    };

    htmlElement.style.setProperty('--el-color-primary-light-3', lighten(color, 50));
    htmlElement.style.setProperty('--el-color-primary-light-5', lighten(color, 80));
    htmlElement.style.setProperty('--el-color-primary-light-7', lighten(color, 110));
    htmlElement.style.setProperty('--el-color-primary-light-8', lighten(color, 130));
    htmlElement.style.setProperty('--el-color-primary-light-9', lighten(color, 150));
    htmlElement.style.setProperty('--el-color-primary-dark-2', darken(color, 30));

    emit('primary-color-changed', color);
    saveSettings();
  };

  const applyFontSize = (size: number) => {
    const htmlElement = document.documentElement;
    htmlElement.style.setProperty('--el-font-size-base', `${size}px`);
    htmlElement.style.setProperty('--el-font-size-small', `${size - 2}px`);
    htmlElement.style.setProperty('--el-font-size-large', `${size + 2}px`);
    saveSettings();
  };

  const applyLayoutDensity = (density: string) => {
    const htmlElement = document.documentElement;
    htmlElement.classList.remove('density-compact', 'density-default', 'density-comfortable');
    htmlElement.classList.add(`density-${density}`);

    // 根据密度调整间距
    const spacingMap = {
      compact: { padding: '4px', margin: '2px', height: '28px' },
      default: { padding: '8px', margin: '4px', height: '32px' },
      comfortable: { padding: '12px', margin: '8px', height: '40px' }
    };

    const spacing = spacingMap[density as keyof typeof spacingMap];
    htmlElement.style.setProperty('--layout-padding', spacing.padding);
    htmlElement.style.setProperty('--layout-margin', spacing.margin);
    htmlElement.style.setProperty('--component-height', spacing.height);

    saveSettings();
  };

  const applyComponentSize = (size: string) => {
    const htmlElement = document.documentElement;
    htmlElement.style.setProperty('--el-component-size', size);
    saveSettings();
  };

  const applyAnimationSettings = () => {
    const htmlElement = document.documentElement;
    
    if (animationsEnabled.value) {
      htmlElement.style.setProperty('--animation-duration-base', `${300 / animationSpeed.value}ms`);
      htmlElement.style.setProperty('--animation-duration-fast', `${200 / animationSpeed.value}ms`);
      htmlElement.style.setProperty('--animation-duration-slow', `${500 / animationSpeed.value}ms`);
      htmlElement.classList.remove('no-animations');
    } else {
      htmlElement.classList.add('no-animations');
    }
    
    saveSettings();
  };

  const applySidebarSettings = () => {
    emit('layout-changed', {
      sidebar: sidebarSettings.value
    });
    saveSettings();
  };

  const applyToolbarSettings = () => {
    emit('layout-changed', {
      toolbar: toolbarSettings.value
    });
    saveSettings();
  };

  const applyCustomCSS = () => {
    // 清除之前的自定义样式
    const existingStyle = document.getElementById('custom-theme-css');
    if (existingStyle) {
      existingStyle.remove();
    }

    if (customCSS.value.trim()) {
      // 创建新的样式元素
      const styleElement = document.createElement('style');
      styleElement.id = 'custom-theme-css';
      styleElement.textContent = customCSS.value;
      document.head.appendChild(styleElement);
    }

    saveSettings();
  };

  const updateBreakpoint = () => {
    const width = window.innerWidth;
    viewportWidth.value = width;

    for (let i = breakpoints.value.length - 1; i >= 0; i--) {
      if (width >= breakpoints.value[i].min) {
        currentBreakpoint.value = breakpoints.value[i].name;
        break;
      }
    }
  };

  const getBreakpointType = (bp: string) => {
    const typeMap = {
      xs: 'danger',
      sm: 'warning',
      md: 'primary',
      lg: 'success',
      xl: 'info'
    };
    return typeMap[bp as keyof typeof typeMap] || 'info';
  };

  const getBreakpointName = (bp: string) => {
    const breakpoint = breakpoints.value.find(b => b.name === bp);
    return breakpoint ? breakpoint.label : bp;
  };

  const getCSSVariableValue = (varName: string) => {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  };

  const showCSSHelp = () => {
    showCSSReference.value = true;
  };

  const resetToDefaults = () => {
    currentTheme.value = 'auto';
    currentPrimaryColor.value = '#409eff';
    fontSize.value = 14;
    layoutDensity.value = 'default';
    componentSize.value = 'default';
    animationsEnabled.value = true;
    animationSpeed.value = 1;
    customCSS.value = '';

    sidebarSettings.value = {
      leftVisible: true,
      rightVisible: true,
      collapsible: true,
      width: 300
    };

    toolbarSettings.value = {
      showIcons: true,
      showText: true,
      position: 'top'
    };

    // 应用所有设置
    applyTheme(currentTheme.value);
    setPrimaryColor(currentPrimaryColor.value);
    applyFontSize(fontSize.value);
    applyLayoutDensity(layoutDensity.value);
    applyComponentSize(componentSize.value);
    applyAnimationSettings();
    applySidebarSettings();
    applyToolbarSettings();
    applyCustomCSS();

    ElMessage.success('已重置为默认设置');
  };

  const saveSettings = () => {
    const settings = {
      theme: currentTheme.value,
      primaryColor: currentPrimaryColor.value,
      fontSize: fontSize.value,
      layoutDensity: layoutDensity.value,
      componentSize: componentSize.value,
      animationsEnabled: animationsEnabled.value,
      animationSpeed: animationSpeed.value,
      customCSS: customCSS.value,
      sidebar: sidebarSettings.value,
      toolbar: toolbarSettings.value
    };

    localStorage.setItem('theme-settings', JSON.stringify(settings));
  };

  const loadSettings = () => {
    const saved = localStorage.getItem('theme-settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        
        currentTheme.value = settings.theme || 'auto';
        currentPrimaryColor.value = settings.primaryColor || '#409eff';
        fontSize.value = settings.fontSize || 14;
        layoutDensity.value = settings.layoutDensity || 'default';
        componentSize.value = settings.componentSize || 'default';
        animationsEnabled.value = settings.animationsEnabled !== false;
        animationSpeed.value = settings.animationSpeed || 1;
        customCSS.value = settings.customCSS || '';

        if (settings.sidebar) {
          sidebarSettings.value = { ...sidebarSettings.value, ...settings.sidebar };
        }
        if (settings.toolbar) {
          toolbarSettings.value = { ...toolbarSettings.value, ...settings.toolbar };
        }

        // 应用设置
        applyTheme(currentTheme.value);
        setPrimaryColor(currentPrimaryColor.value);
        applyFontSize(fontSize.value);
        applyLayoutDensity(layoutDensity.value);
        applyComponentSize(componentSize.value);
        applyAnimationSettings();
        applyCustomCSS();
      } catch (error) {
        console.warn('Failed to load theme settings:', error);
      }
    }
  };

  const saveCustomCSS = () => {
    const settings = {
      theme: currentTheme.value,
      primaryColor: currentPrimaryColor.value,
      fontSize: fontSize.value,
      layoutDensity: layoutDensity.value,
      componentSize: componentSize.value,
      animationsEnabled: animationsEnabled.value,
      animationSpeed: animationSpeed.value,
      customCSS: customCSS.value,
      sidebar: sidebarSettings.value,
      toolbar: toolbarSettings.value,
      timestamp: new Date().toISOString()
    };

    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'theme-settings.json';
    link.click();
    URL.revokeObjectURL(url);

    ElMessage.success('主题设置已导出');
  };

  const loadCustomCSS = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const settings = JSON.parse(e.target?.result as string);
          
          if (settings.theme) currentTheme.value = settings.theme;
          if (settings.primaryColor) currentPrimaryColor.value = settings.primaryColor;
          if (settings.fontSize) fontSize.value = settings.fontSize;
          if (settings.layoutDensity) layoutDensity.value = settings.layoutDensity;
          if (settings.componentSize) componentSize.value = settings.componentSize;
          if (settings.animationsEnabled !== undefined) animationsEnabled.value = settings.animationsEnabled;
          if (settings.animationSpeed) animationSpeed.value = settings.animationSpeed;
          if (settings.customCSS) customCSS.value = settings.customCSS;
          if (settings.sidebar) sidebarSettings.value = { ...sidebarSettings.value, ...settings.sidebar };
          if (settings.toolbar) toolbarSettings.value = { ...toolbarSettings.value, ...settings.toolbar };

          // 应用设置
          applyTheme(currentTheme.value);
          setPrimaryColor(currentPrimaryColor.value);
          applyFontSize(fontSize.value);
          applyLayoutDensity(layoutDensity.value);
          applyComponentSize(componentSize.value);
          applyAnimationSettings();
          applySidebarSettings();
          applyToolbarSettings();
          applyCustomCSS();

          ElMessage.success('主题设置已导入');
        } catch (error) {
          ElMessage.error('设置文件格式错误');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // 生命周期
  onMounted(() => {
    loadSettings();
    updateBreakpoint();
    
    // 监听窗口大小变化
    window.addEventListener('resize', updateBreakpoint);
    
    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (currentTheme.value === 'auto') {
        applyTheme('auto');
      }
    });
  });

  onUnmounted(() => {
    window.removeEventListener('resize', updateBreakpoint);
  });
</script>

<style scoped>
  .theme-manager {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
  }

  .theme-controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .control-card {
    margin-bottom: 16px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .theme-options,
  .layout-options {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .option-group h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .color-picker-group {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .preset-colors {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .color-option {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.3s;
  }

  .color-option:hover {
    transform: scale(1.1);
  }

  .color-option.active {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
  }

  .font-size-info {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 8px;
  }

  .font-label {
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .font-preview {
    font-weight: 500;
    color: var(--el-text-color-primary);
    border: 1px solid var(--el-border-color);
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--el-fill-color-blank);
  }

  .animation-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .speed-label {
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .sidebar-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }

  .sidebar-width {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .width-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .unit {
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .toolbar-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .breakpoint-info {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .current-breakpoint {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .breakpoint-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .viewport-size {
    font-family: monospace;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .breakpoint-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .breakpoint-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid transparent;
    transition: all 0.3s;
  }

  .breakpoint-item.active {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary);
  }

  .bp-name {
    font-size: 13px;
  }

  .bp-range {
    font-family: monospace;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .custom-css {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .css-actions {
    display: flex;
    gap: 8px;
  }

  .css-help {
    display: flex;
    justify-content: flex-end;
  }

  .css-reference {
    max-height: 400px;
    overflow-y: auto;
  }

  .var-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .var-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 0;
  }

  .var-item code {
    background: var(--el-fill-color-light);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 12px;
    font-family: monospace;
    min-width: 200px;
  }

  .var-preview {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid var(--el-border-color);
  }

  .var-value {
    font-family: monospace;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  /* 全局样式 */
  :global(.no-animations *) {
    animation-duration: 0s !important;
    transition-duration: 0s !important;
  }

  :global(.density-compact) {
    --el-component-size-small: 24px;
    --el-component-size: 28px;
    --el-component-size-large: 32px;
  }

  :global(.density-comfortable) {
    --el-component-size-small: 32px;
    --el-component-size: 40px;
    --el-component-size-large: 48px;
  }

  :global(.theme-dark) {
    color-scheme: dark;
  }

  :global(.theme-light) {
    color-scheme: light;
  }
</style>