// Global type declarations for the VSCode Logic Analyzer Extension

declare global {
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }
}

// Node.js global types for extension environment
declare global {
  namespace NodeJS {
    interface Timer {}
    interface Timeout {}
  }
}

export {};
