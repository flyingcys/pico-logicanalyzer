/**
 * 驱动层定时器资源泄漏防护测试
 *
 * 目标：验证 setInterval/setTimeout 命名定时器在 dispose()/stopCapture() 路径被正确清理。
 * 覆盖 RigolSiglentDriver 和 NetworkLogicAnalyzerDriver 的采集监控 interval。
 */

import { RigolSiglentDriver } from '../../../src/drivers/RigolSiglentDriver';
import { NetworkLogicAnalyzerDriver } from '../../../src/drivers/NetworkLogicAnalyzerDriver';

// 网络模块 Mock，避免真实连接
jest.mock('net', () => ({
  Socket: jest.fn().mockImplementation(() => ({ on: jest.fn(), connect: jest.fn(), write: jest.fn(), destroy: jest.fn(), off: jest.fn() }))
}));
jest.mock('dgram', () => ({
  createSocket: jest.fn().mockImplementation(() => ({ on: jest.fn(), send: jest.fn(), close: jest.fn(), off: jest.fn() }))
}));

describe('RigolSiglentDriver 定时器泄漏防护', () => {
  let driver: RigolSiglentDriver;

  afterEach(() => {
    if (driver) {
      driver.dispose();
    }
    jest.restoreAllMocks();
  });

  it('dispose() 时应清理采集监控 setInterval（字段置空）', () => {
    driver = new RigolSiglentDriver('192.168.1.1:5555');
    // 模拟监控定时器处于活跃状态
    (driver as unknown as { _captureMonitorInterval: unknown })._captureMonitorInterval = 99;
    driver.dispose();
    expect(
      (driver as unknown as { _captureMonitorInterval: unknown })._captureMonitorInterval
    ).toBeUndefined();
  });

  it('dispose() 时应调用 clearInterval 清理监控定时器', () => {
    driver = new RigolSiglentDriver('192.168.1.1:5555');
    (driver as unknown as { _captureMonitorInterval: unknown })._captureMonitorInterval = 99;
    const spy = jest.spyOn(global, 'clearInterval');
    driver.dispose();
    expect(spy).toHaveBeenCalledWith(99);
  });

  it('stopCapture() 时应清理采集监控 setInterval', async () => {
    driver = new RigolSiglentDriver('192.168.1.1:5555');
    // 标记为采集中，使 stopCapture 进入清理路径
    (driver as unknown as { _capturing: boolean })._capturing = true;
    (driver as unknown as { _captureMonitorInterval: unknown })._captureMonitorInterval = 99;
    await driver.stopCapture();
    expect(
      (driver as unknown as { _captureMonitorInterval: unknown })._captureMonitorInterval
    ).toBeUndefined();
  });
});

describe('NetworkLogicAnalyzerDriver 定时器泄漏防护', () => {
  let driver: NetworkLogicAnalyzerDriver;

  afterEach(() => {
    if (driver) {
      driver.dispose();
    }
    jest.restoreAllMocks();
  });

  it('dispose() 时应清理采集监控 setInterval（字段置空）', () => {
    driver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
    (driver as unknown as { _captureMonitorInterval: unknown })._captureMonitorInterval = 77;
    driver.dispose();
    expect(
      (driver as unknown as { _captureMonitorInterval: unknown })._captureMonitorInterval
    ).toBeUndefined();
  });

  it('dispose() 时应调用 clearInterval 清理监控定时器', () => {
    driver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
    (driver as unknown as { _captureMonitorInterval: unknown })._captureMonitorInterval = 77;
    const spy = jest.spyOn(global, 'clearInterval');
    driver.dispose();
    expect(spy).toHaveBeenCalledWith(77);
  });

  it('stopCapture() 时应清理采集监控 setInterval', async () => {
    driver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
    (driver as unknown as { _capturing: boolean })._capturing = true;
    (driver as unknown as { _captureMonitorInterval: unknown })._captureMonitorInterval = 77;
    await driver.stopCapture();
    expect(
      (driver as unknown as { _captureMonitorInterval: unknown })._captureMonitorInterval
    ).toBeUndefined();
  });
});
