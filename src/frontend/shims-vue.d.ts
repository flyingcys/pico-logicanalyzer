/**
 * Vue 单文件组件类型声明
 * 为 src/frontend 下的 .vue 导入提供类型支持，与 src/webview/shims-vue.d.ts 协同。
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}
