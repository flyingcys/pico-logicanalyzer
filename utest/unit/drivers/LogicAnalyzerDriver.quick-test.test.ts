/**
 * LogicAnalyzerDriver 快速测试
 * 用于验证测试环境和基础功能
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';

// Mock dependencies
jest.mock('serialport', () => ({
    SerialPort: jest.fn().mockImplementation(() => ({
        open: jest.fn(),
        close: jest.fn(),
        write: jest.fn(),
        pipe: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        isOpen: false
    }))
}));

jest.mock('net', () => ({
    Socket: jest.fn().mockImplementation(() => ({
        connect: jest.fn(),
        write: jest.fn(),
        destroy: jest.fn(),
        on: jest.fn(),
        off: jest.fn()
    }))
}));

jest.mock('@serialport/parser-readline', () => ({
    ReadlineParser: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        off: jest.fn(),
        once: jest.fn()
    }))
}));

describe('LogicAnalyzerDriver 快速测试', () => {
    it('应该能够创建驱动实例', () => {
        const driver = new LogicAnalyzerDriver('COM3');
        expect(driver).toBeDefined();
        expect(driver.isCapturing).toBe(false);
        expect(driver.isNetwork).toBe(false);
    });

    it('应该处理空连接字符串错误', () => {
        expect(() => new LogicAnalyzerDriver('')).toThrow('连接字符串不能为空');
    });

    it('应该识别网络地址格式', () => {
        const driver = new LogicAnalyzerDriver('192.168.1.100:8080');
        expect(driver).toBeDefined();
    });

    it('应该返回正确的设备状态', async () => {
        const driver = new LogicAnalyzerDriver('COM3');
        const status = await driver.getStatus();
        expect(status.isConnected).toBe(false);
        expect(status.isCapturing).toBe(false);
    });

    it('应该正确清理资源', () => {
        const driver = new LogicAnalyzerDriver('COM3');
        expect(() => driver.dispose()).not.toThrow();
    });
});