import { describe, it, expect } from 'vitest';
import { fileToDocument } from './fileLoader';

describe('fileLoader', () => {
  it('拒绝非 .lac 扩展名', async () => {
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    await expect(fileToDocument(file)).rejects.toThrow(/仅支持 .lac/);
  });

  it('把 .lac 文件读成 FrontendDocumentData', async () => {
    const content = JSON.stringify({
      settings: { frequency: 1000, captureChannels: [] },
    });
    const file = new File([content], 'demo.lac', { type: 'application/json' });
    const doc = await fileToDocument(file);
    expect(doc.fileName).toBe('demo.lac');
    expect(doc.uri).toContain('demo.lac');
    expect(doc.content).toBe(content);
  });
});
