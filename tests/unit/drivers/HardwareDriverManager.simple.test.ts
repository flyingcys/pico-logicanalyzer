/**
 * HardwareDriverManager 基础功能验证测试
 * 错误驱动学习 - 验证根本问题
 */

import { vi } from 'vitest';
import { HardwareDriverManager } from '../../../src/drivers/HardwareDriverManager';

// 最小化Mock - 只Mock驱动构造函数
vi.mock('../../../src/drivers/LogicAnalyzerDriver');
vi.mock('../../../src/drivers/SaleaeLogicDriver');
vi.mock('../../../src/drivers/RigolSiglentDriver');
vi.mock('../../../src/drivers/SigrokAdapter');
vi.mock('../../../src/drivers/NetworkLogicAnalyzerDriver');
vi.mock('../../../src/drivers/MultiAnalyzerDriver');

describe('HardwareDriverManager 基础功能验证', () => {
  let manager: HardwareDriverManager;

  it('应该成功创建HardwareDriverManager实例', () => {
    expect(() => {
      manager = new HardwareDriverManager();
    }).not.toThrow();
    
    expect(manager).toBeInstanceOf(HardwareDriverManager);
  });

  it('应该正确继承EventEmitter功能', () => {
    manager = new HardwareDriverManager();
    
    console.log('Manager constructor name:', manager.constructor.name);
    console.log('Manager prototype:', Object.getPrototypeOf(manager));
    console.log('Manager keys:', Object.getOwnPropertyNames(manager));
    console.log('Manager methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(manager)));
    console.log('Is EventEmitter instance:', manager instanceof require('events').EventEmitter);
    
    expect(typeof manager.on).toBe('function');
    expect(typeof manager.emit).toBe('function');
    expect(typeof manager.off).toBe('function');
  });

  it('应该正确初始化驱动注册表', () => {
    manager = new HardwareDriverManager();
    
    const drivers = manager.getRegisteredDrivers();
    console.log('Registered drivers:', drivers.length);
    
    expect(Array.isArray(drivers)).toBe(true);
  });

  it('应该正确处理驱动注册', () => {
    manager = new HardwareDriverManager();
    
    const customDriver = {
      id: 'test-driver',
      name: 'Test Driver',
      description: 'Test driver for verification',
      version: '1.0.0',
      driverClass: class TestDriver {} as any,
      supportedDevices: ['test'],
      priority: 50
    };

    expect(() => {
      manager.registerDriver(customDriver);
    }).not.toThrow();
  });
});
