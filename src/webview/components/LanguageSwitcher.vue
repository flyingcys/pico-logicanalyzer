<!--
语言切换器组件
支持中英文切换
-->

<template>
  <div class="language-switcher">
    <el-dropdown @command="handleLanguageChange" trigger="click">
      <el-button type="text" class="language-button">
        <span class="language-flag">{{ currentLanguage.flag }}</span>
        <span class="language-name">{{ currentLanguage.name }}</span>
        <el-icon class="el-icon--right">
          <ArrowDown />
        </el-icon>
      </el-button>
      
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="language in availableLanguages"
            :key="language.code"
            :command="language.code"
            :class="{ active: language.code === currentLocale }"
          >
            <div class="language-option">
              <span class="language-flag">{{ language.flag }}</span>
              <span class="language-name">{{ language.name }}</span>
              <el-icon v-if="language.code === currentLocale" class="check-icon">
                <Check />
              </el-icon>
            </div>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { ArrowDown, Check } from '@element-plus/icons-vue';
  import { switchLocale, getCurrentLocale, supportedLocales } from '../i18n';
  import { ElMessage } from 'element-plus';

  // i18n相关
  const { locale, t } = useI18n();

  // 当前语言设置
  const currentLocale = computed(() => getCurrentLocale());

  // 可用语言列表  
  const availableLanguages = computed(() => supportedLocales);

  // 当前语言信息
  const currentLanguage = computed(() => {
    return availableLanguages.value.find(lang => lang.code === currentLocale.value) || availableLanguages.value[0];
  });

  // Emits
  const emit = defineEmits<{
    'language-changed': [locale: string];
  }>();

  // 处理语言切换
  const handleLanguageChange = (languageCode: string) => {
    if (languageCode === currentLocale.value) {
      return;
    }

    try {
      // 切换语言
      switchLocale(languageCode);
      
      // 显示成功消息
      const language = availableLanguages.value.find(lang => lang.code === languageCode);
      if (language) {
        ElMessage.success({
          message: languageCode === 'zh-CN' ? 
            `已切换到${language.name}` : 
            `Switched to ${language.name}`,
          duration: 2000
        });
      }

      // 触发事件
      emit('language-changed', languageCode);

      // 刷新页面以确保所有组件更新语言
      // 注意：在生产环境中可能需要更优雅的方式
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Language switch failed:', error);
      ElMessage.error({
        message: currentLocale.value === 'zh-CN' ? 
          '语言切换失败' : 
          'Language switch failed',
        duration: 3000
      });
    }
  };

  // 暴露方法
  defineExpose({
    switchToLanguage: handleLanguageChange,
    getCurrentLanguage: () => currentLanguage.value,
    getAvailableLanguages: () => availableLanguages.value
  });
</script>

<style scoped>
  .language-switcher {
    display: inline-block;
  }

  .language-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 4px;
    transition: all 0.3s;
    font-size: 13px;
  }

  .language-button:hover {
    background-color: var(--el-fill-color-light);
  }

  .language-flag {
    font-size: 16px;
    line-height: 1;
  }

  .language-name {
    font-size: 13px;
    color: var(--el-text-color-primary);
    font-weight: 400;
  }

  .language-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-width: 120px;
  }

  .language-option .language-flag {
    font-size: 16px;
  }

  .language-option .language-name {
    flex: 1;
    font-size: 13px;
  }

  .check-icon {
    color: var(--el-color-primary);
    font-size: 14px;
  }

  .el-dropdown-menu__item.active {
    background-color: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
  }

  .el-dropdown-menu__item.active .language-name {
    color: var(--el-color-primary);
    font-weight: 500;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .language-name {
      display: none;
    }
    
    .language-option .language-name {
      display: block;
    }
  }
</style>