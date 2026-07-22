import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { FrontendDocumentData } from '@frontend-platform/host/types';

// ---- mock element-plus(ElMessage)----
const ElMessageMock = {
  success: vi.fn(),
  error: vi.fn(),
};
vi.mock('element-plus', () => ({
  ElMessage: ElMessageMock,
}));

// ---- mock fileLoader(fileToDocument)----
const fileToDocumentMock = vi.fn();
vi.mock('./fileLoader', () => ({
  fileToDocument: fileToDocumentMock,
}));

// ---- stub window.__WEB_HOST__ ----
const loadDocumentSpy = vi.fn();
let pinia: Pinia;
beforeEach(() => {
  pinia = createPinia();
  // 同一实例同时作为 app 安装与全局 active,避免 setup 时取不到 pinia
  setActivePinia(pinia);
  fileToDocumentMock.mockReset();
  ElMessageMock.success.mockReset();
  ElMessageMock.error.mockReset();
  loadDocumentSpy.mockReset();
  (
    window as unknown as { __WEB_HOST__: unknown }
  ).__WEB_HOST__ = { loadDocument: loadDocumentSpy };
});

afterEach(() => {
  delete (window as unknown as { __WEB_HOST__?: unknown }).__WEB_HOST__;
});

// 动态导入,确保 mock 生效
const mountComponent = async () => {
  const FileDropLayer = (await import('./FileDropLayer.vue')).default;
  return mount(FileDropLayer, { global: { plugins: [pinia] } });
};

const sampleDoc: FrontendDocumentData = {
  uri: 'file:///demo.lac',
  fileName: 'demo.lac',
  content: '{"Settings":{}}',
};

describe('FileDropLayer', () => {
  it('渲染"打开 .lac 文件"按钮', async () => {
    const wrapper = await mountComponent();
    expect(wrapper.text()).toContain('打开 .lac 文件');
  });

  it('点按钮触发隐藏 input 的 click', async () => {
    const wrapper = await mountComponent();
    const input = wrapper.find('input[type="file"]');
    const clickSpy = vi.spyOn(input.element, 'click');
    await wrapper.find('button').trigger('click');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('选择有效 .lac → fileToDocument 解析后调 webHost.loadDocument + sessionStore.applyDocument + ElMessage.success', async () => {
    fileToDocumentMock.mockResolvedValue(sampleDoc);
    const wrapper = await mountComponent();
    const input = wrapper.find('input[type="file"]');

    // 模拟用户选了文件
    const file = new File(['{}'], 'demo.lac', { type: 'application/json' });
    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true,
    });
    await input.trigger('change');

    // 等异步 loadFile 完成
    await vi.dynamicImportSettled();

    expect(fileToDocumentMock).toHaveBeenCalledWith(file);
    expect(loadDocumentSpy).toHaveBeenCalledWith(sampleDoc);
    expect(ElMessageMock.success).toHaveBeenCalledWith('已加载 demo.lac');
  });

  it('选择非 .lac → fileToDocument reject → ElMessage.error', async () => {
    fileToDocumentMock.mockRejectedValue(new Error('仅支持 .lac 文件,收到: note.txt'));
    const wrapper = await mountComponent();
    const input = wrapper.find('input[type="file"]');

    const file = new File(['x'], 'note.txt', { type: 'text/plain' });
    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true,
    });
    await input.trigger('change');
    await vi.dynamicImportSettled();

    expect(fileToDocumentMock).toHaveBeenCalledWith(file);
    expect(ElMessageMock.error).toHaveBeenCalledWith('仅支持 .lac 文件,收到: note.txt');
    // 失败时不应调 loadDocument / success
    expect(loadDocumentSpy).not.toHaveBeenCalled();
    expect(ElMessageMock.success).not.toHaveBeenCalled();
  });

  it('拖拽 .lac 文件到 drop 区 → 触发 fileToDocument + loadDocument', async () => {
    fileToDocumentMock.mockResolvedValue(sampleDoc);
    const wrapper = await mountComponent();
    const dropZone = wrapper.find('.web-drop-layer');

    const file = new File(['{}'], 'dropped.lac', { type: 'application/json' });
    // jsdom 无 DataTransfer 构造器,用 plain object 模拟 dataTransfer.files
    await dropZone.trigger('drop', { dataTransfer: { files: [file] } });
    await vi.dynamicImportSettled();

    expect(fileToDocumentMock).toHaveBeenCalledWith(file);
    expect(loadDocumentSpy).toHaveBeenCalledWith(sampleDoc);
    expect(ElMessageMock.success).toHaveBeenCalledWith('已加载 demo.lac');
  });
});
