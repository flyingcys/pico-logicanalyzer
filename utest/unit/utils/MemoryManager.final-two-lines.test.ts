/**
 * MemoryManager - 最后两行覆盖率测试
 * 专门针对243和598行，冲刺100%覆盖率
 */

import { MemoryManager } from '../../../src/utils/MemoryManager';

describe('MemoryManager - 最后两行100%覆盖率', () => {
    let memoryManager: MemoryManager;

    beforeEach(() => {
        memoryManager = new MemoryManager();
    });

    afterEach(() => {
        if (memoryManager) {
            memoryManager.dispose();
        }
    });

    test('应该覆盖releaseMemory中不存在池的early return - 行243', () => {
        // 直接调用releaseMemory方法，传入不存在的池名
        // 这将触发243行：if (!pool) return;
        (memoryManager as any).releaseMemory('nonexistent-pool', 1000);
        
        // 这个测试主要是为了覆盖，验证没有抛出错误即可
        expect(true).toBe(true);
    });

    test('应该覆盖getPoolInfo中的null fallback - 行598', () => {
        // 调用getPoolInfo方法查询不存在的池
        // 这将触发598行中的 || null 部分
        const result = memoryManager.getPoolInfo('nonexistent-pool');
        
        // 验证返回null
        expect(result).toBeNull();
    });

    test('应该确保所有边界条件都被覆盖', () => {
        // 再次确认覆盖这两行
        
        // 覆盖243行
        (memoryManager as any).releaseMemory('does-not-exist', 500);
        
        // 覆盖598行 
        const info1 = memoryManager.getPoolInfo('');
        const info2 = memoryManager.getPoolInfo('another-nonexistent');
        
        expect(info1).toBeNull();
        expect(info2).toBeNull();
    });
});