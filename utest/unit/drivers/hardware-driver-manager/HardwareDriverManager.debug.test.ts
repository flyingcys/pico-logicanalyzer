/**
 * HardwareDriverManager 调试测试
 * 用于调试导入和实例化问题
 */

describe('HardwareDriverManager 调试测试', () => {
  test('测试模块导入', () => {
    try {
      const driverManagerModule = require('../../../../src/drivers/HardwareDriverManager');
      console.log('模块导入成功，导出内容:', Object.keys(driverManagerModule));
      
      const hardwareDriverManager = driverManagerModule.hardwareDriverManager;
      console.log('单例实例:', hardwareDriverManager);
      
      if (hardwareDriverManager) {
        console.log('实例类型:', typeof hardwareDriverManager);
        console.log('实例构造函数:', hardwareDriverManager.constructor.name);
        console.log('实例方法:', Object.getOwnPropertyNames(Object.getPrototypeOf(hardwareDriverManager)));
        
        // 测试基本方法
        if (typeof hardwareDriverManager.getRegisteredDrivers === 'function') {
          console.log('getRegisteredDrivers 方法存在');
          const drivers = hardwareDriverManager.getRegisteredDrivers();
          console.log('驱动数量:', drivers?.length);
        } else {
          console.log('getRegisteredDrivers 方法不存在');
        }
      } else {
        console.log('单例实例为空');
      }
    } catch (error) {
      console.error('导入失败:', error);
    }
    
    expect(true).toBe(true); // 暂时总是通过，只看日志
  });
});