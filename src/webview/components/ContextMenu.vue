<!--
右键菜单组件
提供上下文相关的操作菜单，提升用户交互体验
-->

<script setup lang="ts">
  import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
  import { ArrowRight, Check } from '@element-plus/icons-vue';

  // 菜单项接口
  export interface MenuItem {
    id: string;
    type?: 'normal' | 'divider' | 'submenu' | 'checkbox';
    label?: string;
    icon?: any;
    shortcut?: string;
    disabled?: boolean;
    checked?: boolean;
    children?: MenuItem[];
    action?: () => void;
    data?: any; // 附加数据
  }

  // Props
  interface Props {
    visible: boolean;
    x: number;
    y: number;
    items: MenuItem[];
  }

  const props = withDefaults(defineProps<Props>(), {
    visible: false,
    x: 0,
    y: 0,
    items: () => []
  });

  // Emits
  const emit = defineEmits<{
    'update:visible': [visible: boolean];
    'item-click': [item: MenuItem];
    'hide': [];
  }>();

  // 响应式数据
  const menuRef = ref<HTMLElement>();
  const submenuIndex = ref(-1);
  const submenuPosition = ref({ x: 0, y: 0 });

  // 计算属性
  const menuItems = computed(() => props.items);

  const menuStyle = computed(() => ({
    left: `${props.x}px`,
    top: `${props.y}px`
  }));

  const submenuStyle = computed(() => ({
    left: `${submenuPosition.value.x}px`,
    top: `${submenuPosition.value.y}px`
  }));

  // 方法
  const handleItemClick = (item: MenuItem) => {
    if (item.disabled) return;

    emit('item-click', item);

    if (item.action) {
      try {
        item.action();
      } catch (error) {
        console.error('菜单项执行错误:', error);
      }
    }

    hideMenu();
  };

  const showSubmenu = (item: MenuItem, index: number) => {
    if (item.disabled || !item.children?.length) return;

    submenuIndex.value = index;

    nextTick(() => {
      const menuElement = menuRef.value;
      if (menuElement) {
        const menuRect = menuElement.getBoundingClientRect();
        submenuPosition.value = {
          x: menuRect.width - 2,
          y: index * 32 // 菜单项高度
        };
      }
    });
  };

  const hideSubmenu = () => {
    setTimeout(() => {
      submenuIndex.value = -1;
    }, 100);
  };

  const hideMenu = () => {
    emit('update:visible', false);
    emit('hide');
    submenuIndex.value = -1;
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (!props.visible) return;

    const menuElement = menuRef.value;
    if (menuElement && !menuElement.contains(event.target as Node)) {
      hideMenu();
    }
  };

  const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && props.visible) {
      hideMenu();
    }
  };

  // 生命周期
  onMounted(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleEscapeKey);
  });

  // 暴露方法
  defineExpose({
    hide: hideMenu
  });
</script>

<template>
  <teleport to="body">
    <div
      v-show="visible"
      ref="menuRef"
      class="context-menu"
      :style="menuStyle"
      @contextmenu.prevent
    >
      <div class="context-menu-content">
        <template
          v-for="(item, index) in menuItems"
          :key="item.id || index"
        >
          <!-- 分隔线 -->
          <div
            v-if="item.type === 'divider'"
            class="menu-divider"
          />

          <!-- 子菜单 -->
          <div
            v-else-if="item.type === 'submenu'"
            class="menu-item submenu"
            :class="{ disabled: item.disabled }"
            @mouseenter="showSubmenu(item, index)"
            @mouseleave="hideSubmenu"
          >
            <div class="menu-item-content">
              <el-icon
                v-if="item.icon"
                class="menu-icon"
              >
                <component :is="item.icon" />
              </el-icon>
              <span class="menu-label">{{ item.label }}</span>
              <el-icon class="submenu-arrow">
                <ArrowRight />
              </el-icon>
            </div>

            <!-- 子菜单内容 -->
            <div
              v-if="submenuIndex === index"
              class="submenu-content"
              :style="submenuStyle"
            >
              <div
                v-for="subItem in item.children"
                :key="subItem.id"
                class="menu-item"
                :class="{ disabled: subItem.disabled }"
                @click="handleItemClick(subItem)"
              >
                <div class="menu-item-content">
                  <el-icon
                    v-if="subItem.icon"
                    class="menu-icon"
                  >
                    <component :is="subItem.icon" />
                  </el-icon>
                  <span class="menu-label">{{ subItem.label }}</span>
                  <span
                    v-if="subItem.shortcut"
                    class="menu-shortcut"
                  >{{ subItem.shortcut }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 普通菜单项 -->
          <div
            v-else
            class="menu-item"
            :class="{ disabled: item.disabled, checked: item.checked }"
            @click="handleItemClick(item)"
          >
            <div class="menu-item-content">
              <el-icon
                v-if="item.icon"
                class="menu-icon"
              >
                <component :is="item.icon" />
              </el-icon>
              <span class="menu-label">{{ item.label }}</span>
              <span
                v-if="item.shortcut"
                class="menu-shortcut"
              >{{ item.shortcut }}</span>
              <el-icon
                v-if="item.checked"
                class="menu-check"
              >
                <Check />
              </el-icon>
            </div>
          </div>
        </template>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
  .context-menu {
    position: fixed;
    z-index: 9999;
    min-width: 180px;
    background: #ffffff;
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
    padding: 4px 0;
    font-size: 14px;
    user-select: none;
  }

  .context-menu-content {
    max-height: 400px;
    overflow-y: auto;
  }

  .menu-item {
    position: relative;
    padding: 0;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .menu-item:hover:not(.disabled) {
    background-color: #f5f7fa;
  }

  .menu-item.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .menu-item.checked {
    background-color: #ecf5ff;
  }

  .menu-item-content {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    gap: 8px;
  }

  .menu-icon {
    font-size: 16px;
    color: #606266;
    flex-shrink: 0;
  }

  .menu-label {
    flex: 1;
    color: #303133;
    white-space: nowrap;
  }

  .menu-shortcut {
    font-size: 12px;
    color: #909399;
    font-family: monospace;
  }

  .menu-check {
    font-size: 14px;
    color: #409eff;
  }

  .submenu-arrow {
    font-size: 12px;
    color: #909399;
  }

  .menu-divider {
    height: 1px;
    background-color: #e4e7ed;
    margin: 4px 0;
  }

  .submenu {
    position: relative;
  }

  .submenu-content {
    position: absolute;
    top: 0;
    background: #ffffff;
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
    padding: 4px 0;
    min-width: 160px;
    z-index: 10000;
  }

  /* 深色主题支持 */
  @media (prefers-color-scheme: dark) {
    .context-menu,
    .submenu-content {
      background: #2d2d2d;
      border-color: #4c4d4f;
      color: #e5eaf3;
    }

    .menu-item:hover:not(.disabled) {
      background-color: #3a3a3a;
    }

    .menu-item.checked {
      background-color: #1d2b3a;
    }

    .menu-label {
      color: #e5eaf3;
    }

    .menu-icon,
    .submenu-arrow {
      color: #a8abb2;
    }

    .menu-divider {
      background-color: #4c4d4f;
    }
  }

  /* 滚动条样式 */
  .context-menu-content::-webkit-scrollbar {
    width: 6px;
  }

  .context-menu-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .context-menu-content::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }

  .context-menu-content::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
</style>
