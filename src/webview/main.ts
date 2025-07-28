import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import App from './App.vue';
import i18n from './i18n';

// 类型声明
declare global {
  interface Window {
    vscode: any;
    documentData: {
      uri: string;
      fileName: string;
      content: string;
    };
  }
}

// 创建Vue应用
const app = createApp(App);

// 安装Pinia状态管理
const pinia = createPinia();
app.use(pinia);

// 安装Element Plus UI组件库
app.use(ElementPlus);

// 安装国际化
app.use(i18n);

// 挂载应用
app.mount('#app');

// 向VSCode扩展发送ready消息
if (window.vscode) {
  window.vscode.postMessage({ type: 'ready' });
}
