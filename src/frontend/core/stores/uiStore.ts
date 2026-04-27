import { defineStore } from 'pinia';

export const useUiStore = defineStore('frontend-ui', {
  state: () => ({
    activeTab: 'decoder',
    showShortcutHelp: false
  })
});
