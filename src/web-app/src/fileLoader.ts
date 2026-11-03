import type { FrontendDocumentData } from '@frontend-platform/host/types';

const LAC_EXT = /\.lac$/i;

/**
 * 把浏览器 File 读成 FrontendDocumentData。
 * 用 FileReader(而非 file.text())以保证 jsdom 测试环境兼容。
 */
export function fileToDocument(file: File): Promise<FrontendDocumentData> {
  return new Promise((resolve, reject) => {
    if (!LAC_EXT.test(file.name)) {
      reject(new Error(`仅支持 .lac 文件,收到: ${file.name}`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        uri: `file:///${file.name}`,
        fileName: file.name,
        content: String(reader.result ?? ''),
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'));
    reader.readAsText(file);
  });
}
