import { defineStore } from 'pinia';

function readInitialFileName(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  if (window.__FRONTEND_BOOTSTRAP__?.document?.fileName) {
    return window.__FRONTEND_BOOTSTRAP__.document.fileName;
  }

  return window.documentData?.fileName || '';
}

export const useSessionStore = defineStore('frontend-session', {
  state: () => ({
    fileName: readInitialFileName()
  })
});
