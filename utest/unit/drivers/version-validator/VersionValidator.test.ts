/**
 * VersionValidator 模块全面单元测试
 * 测试目标: 达到100%覆盖率
 * 测试模块: src/drivers/VersionValidator.ts
 */

import { VersionValidator, DeviceVersion, DeviceConnectionException } from '../../../../src/drivers/VersionValidator';

describe('VersionValidator 模块测试', () => {
  
  describe('DeviceVersion 类测试', () => {
    it('应该正确构造 DeviceVersion 对象', () => {
      const version = new DeviceVersion(1, 7, true, 'V1_7');
      
      expect(version.major).toBe(1);
      expect(version.minor).toBe(7);
      expect(version.isValid).toBe(true);
      expect(version.versionString).toBe('V1_7');
    });

    it('应该正确构造无效版本对象', () => {
      const version = new DeviceVersion(0, 0, false, '');
      
      expect(version.major).toBe(0);
      expect(version.minor).toBe(0);
      expect(version.isValid).toBe(false);
      expect(version.versionString).toBe('');
    });

    it('应该支持高版本号', () => {
      const version = new DeviceVersion(2, 5, true, 'V2_5');
      
      expect(version.major).toBe(2);
      expect(version.minor).toBe(5);
      expect(version.isValid).toBe(true);
      expect(version.versionString).toBe('V2_5');
    });
  });

  describe('VersionValidator 静态常量测试', () => {
    it('应该正确定义最低版本常量', () => {
      expect(VersionValidator.MAJOR_VERSION).toBe(1);
      expect(VersionValidator.MINOR_VERSION).toBe(7);
    });
  });

  describe('VersionValidator.getVersion() 测试', () => {
    
    describe('标准格式版本字符串测试', () => {
      it('应该正确解析标准格式 V1_7', () => {
        const version = VersionValidator.getVersion('LOGIC_ANALYZER_V1_7');
        
        expect(version.major).toBe(1);
        expect(version.minor).toBe(7);
        expect(version.isValid).toBe(true);
        expect(version.versionString).toBe('LOGIC_ANALYZER_V1_7');
      });

      it('应该正确解析简单格式 V1_7', () => {
        const version = VersionValidator.getVersion('V1_7');
        
        expect(version.major).toBe(1);
        expect(version.minor).toBe(7);
        expect(version.isValid).toBe(true);
        expect(version.versionString).toBe('V1_7');
      });

      it('应该正确解析大写格式 V2_0', () => {
        const version = VersionValidator.getVersion('V2_0');
        
        expect(version.major).toBe(2);
        expect(version.minor).toBe(0);
        expect(version.isValid).toBe(true);
        expect(version.versionString).toBe('V2_0');
      });

      it('应该正确解析小写格式 v1_8', () => {
        const version = VersionValidator.getVersion('device_v1_8_final');
        
        expect(version.major).toBe(1);
        expect(version.minor).toBe(8);
        expect(version.isValid).toBe(true);
        expect(version.versionString).toBe('device_v1_8_final');
      });

      it('应该正确解析多位数版本 V10_25', () => {
        const version = VersionValidator.getVersion('V10_25');
        
        expect(version.major).toBe(10);
        expect(version.minor).toBe(25);
        expect(version.isValid).toBe(true);
        expect(version.versionString).toBe('V10_25');
      });
    });

    describe('点号格式版本字符串测试', () => {
      it('应该正确解析点号格式 1.7', () => {
        const version = VersionValidator.getVersion('1.7');
        
        expect(version.major).toBe(1);
        expect(version.minor).toBe(7);
        expect(version.isValid).toBe(true);
        expect(version.versionString).toBe('1.7');
      });

      it('应该正确解析点号格式 2.0', () => {
        const version = VersionValidator.getVersion('2.0');
        
        expect(version.major).toBe(2);
        expect(version.minor).toBe(0);
        expect(version.isValid).toBe(true);
        expect(version.versionString).toBe('2.0');
      });

      it('应该正确解析复杂点号格式 device-1.8-release', () => {
        const version = VersionValidator.getVersion('device-1.8-release');
        
        expect(version.major).toBe(1);
        expect(version.minor).toBe(8);
        expect(version.isValid).toBe(true);
        expect(version.versionString).toBe('device-1.8-release');
      });

      it('应该正确解析多位数点号格式 15.32', () => {
        const version = VersionValidator.getVersion('15.32');
        
        expect(version.major).toBe(15);
        expect(version.minor).toBe(32);
        expect(version.isValid).toBe(true);
        expect(version.versionString).toBe('15.32');
      });
    });

    describe('版本有效性验证测试', () => {
      it('应该将低于最低版本的版本标记为无效', () => {
        const version = VersionValidator.getVersion('V1_6');
        
        expect(version.major).toBe(1);
        expect(version.minor).toBe(6);
        expect(version.isValid).toBe(false);
        expect(version.versionString).toBe('V1_6');
      });

      it('应该将等于最低版本的版本标记为有效', () => {
        const version = VersionValidator.getVersion('V1_7');
        
        expect(version.major).toBe(1);
        expect(version.minor).toBe(7);
        expect(version.isValid).toBe(true);
      });

      it('应该将高于最低主版本的版本标记为有效', () => {
        const version = VersionValidator.getVersion('V2_0');
        
        expect(version.major).toBe(2);
        expect(version.minor).toBe(0);
        expect(version.isValid).toBe(true);
      });

      it('应该将相同主版本但高于最低次版本的版本标记为有效', () => {
        const version = VersionValidator.getVersion('V1_8');
        
        expect(version.major).toBe(1);
        expect(version.minor).toBe(8);
        expect(version.isValid).toBe(true);
      });

      it('应该将点号格式低版本标记为无效', () => {
        const version = VersionValidator.getVersion('1.6');
        
        expect(version.major).toBe(1);
        expect(version.minor).toBe(6);
        expect(version.isValid).toBe(false);
      });
    });

    describe('异常输入处理测试', () => {
      it('应该处理 undefined 输入', () => {
        const version = VersionValidator.getVersion(undefined);
        
        expect(version.major).toBe(0);
        expect(version.minor).toBe(0);
        expect(version.isValid).toBe(false);
        expect(version.versionString).toBe('');
      });

      it('应该处理 null 输入', () => {
        const version = VersionValidator.getVersion(null as any);
        
        expect(version.major).toBe(0);
        expect(version.minor).toBe(0);
        expect(version.isValid).toBe(false);
        expect(version.versionString).toBe('');
      });

      it('应该处理空字符串输入', () => {
        const version = VersionValidator.getVersion('');
        
        expect(version.major).toBe(0);
        expect(version.minor).toBe(0);
        expect(version.isValid).toBe(false);
        expect(version.versionString).toBe('');
      });

      it('应该处理只有空格的字符串', () => {
        const version = VersionValidator.getVersion('   ');
        
        expect(version.major).toBe(0);
        expect(version.minor).toBe(0);
        expect(version.isValid).toBe(false);
        expect(version.versionString).toBe('');
      });

      it('应该处理非字符串类型输入', () => {
        const version = VersionValidator.getVersion(123 as any);
        
        expect(version.major).toBe(0);
        expect(version.minor).toBe(0);
        expect(version.isValid).toBe(false);
        expect(version.versionString).toBe('');
      });

      it('应该处理无效格式的字符串', () => {
        const version = VersionValidator.getVersion('invalid_version_string');
        
        expect(version.major).toBe(0);
        expect(version.minor).toBe(0);
        expect(version.isValid).toBe(false);
        expect(version.versionString).toBe('invalid_version_string');
      });

      it('应该处理包含非数字字符的版本', () => {
        const version = VersionValidator.getVersion('Va_b');
        
        expect(version.major).toBe(0);
        expect(version.minor).toBe(0);
        expect(version.isValid).toBe(false);
        expect(version.versionString).toBe('Va_b');
      });

      it('应该处理点号格式但非数字的版本', () => {
        const version = VersionValidator.getVersion('a.b');
        
        expect(version.major).toBe(0);
        expect(version.minor).toBe(0);
        expect(version.isValid).toBe(false);
        expect(version.versionString).toBe('a.b');
      });

      it('应该处理部分数字的点号格式', () => {
        const version = VersionValidator.getVersion('1.b');
        
        expect(version.major).toBe(0);
        expect(version.minor).toBe(0);
        expect(version.isValid).toBe(false);
        expect(version.versionString).toBe('1.b');
      });

      it('应该处理带前后空格的版本字符串', () => {
        const version = VersionValidator.getVersion('  V1_7  ');
        
        expect(version.major).toBe(1);
        expect(version.minor).toBe(7);
        expect(version.isValid).toBe(true);
        expect(version.versionString).toBe('V1_7');
      });

      it('应该处理标准格式但包含非数字的版本', () => {
        // 构造一个能匹配 V(\d+)_(\d+) 但 parseInt 会失败的字符串
        // 通过使用非常规数字字符来触发第62行
        const version = VersionValidator.getVersion('V∞_∞');
        
        expect(version.major).toBe(0);
        expect(version.minor).toBe(0);
        expect(version.isValid).toBe(false);
        expect(version.versionString).toBe('V∞_∞');
      });

      it('应该处理点号格式但包含非数字的版本', () => {
        // 构造一个能匹配 (\d+)\.(\d+) 但 parseInt 会失败的字符串
        // 通过使用非常规数字字符来触发第49行
        const version = VersionValidator.getVersion('∞.∞');
        
        expect(version.major).toBe(0);
        expect(version.minor).toBe(0);
        expect(version.isValid).toBe(false);
        expect(version.versionString).toBe('∞.∞');
      });
    });

    describe('边界条件测试', () => {
      it('应该处理版本 0.0', () => {
        const version = VersionValidator.getVersion('0.0');
        
        expect(version.major).toBe(0);
        expect(version.minor).toBe(0);
        expect(version.isValid).toBe(false);
      });

      it('应该处理极大的版本号', () => {
        const version = VersionValidator.getVersion('999.999');
        
        expect(version.major).toBe(999);
        expect(version.minor).toBe(999);
        expect(version.isValid).toBe(true);
      });

      it('应该处理只有主版本号的情况', () => {
        const version = VersionValidator.getVersion('V1_');
        
        expect(version.major).toBe(0);
        expect(version.minor).toBe(0);
        expect(version.isValid).toBe(false);
        expect(version.versionString).toBe('V1_');
      });

      it('应该处理只有次版本号的情况', () => {
        const version = VersionValidator.getVersion('V_7');
        
        expect(version.major).toBe(0);
        expect(version.minor).toBe(0);
        expect(version.isValid).toBe(false);
        expect(version.versionString).toBe('V_7');
      });
    });
  });

  describe('VersionValidator.isValidVersion() 测试', () => {
    it('应该正确验证有效版本', () => {
      expect(VersionValidator.isValidVersion('V1_7')).toBe(true);
      expect(VersionValidator.isValidVersion('V1_8')).toBe(true);
      expect(VersionValidator.isValidVersion('V2_0')).toBe(true);
      expect(VersionValidator.isValidVersion('1.7')).toBe(true);
      expect(VersionValidator.isValidVersion('2.0')).toBe(true);
    });

    it('应该正确验证无效版本', () => {
      expect(VersionValidator.isValidVersion('V1_6')).toBe(false);
      expect(VersionValidator.isValidVersion('V0_9')).toBe(false);
      expect(VersionValidator.isValidVersion('1.6')).toBe(false);
      expect(VersionValidator.isValidVersion('0.9')).toBe(false);
    });

    it('应该正确处理异常输入', () => {
      expect(VersionValidator.isValidVersion(undefined)).toBe(false);
      expect(VersionValidator.isValidVersion(null as any)).toBe(false);
      expect(VersionValidator.isValidVersion('')).toBe(false);
      expect(VersionValidator.isValidVersion('invalid')).toBe(false);
    });

    it('应该正确处理边界版本', () => {
      expect(VersionValidator.isValidVersion('V1_7')).toBe(true); // 正好等于最低版本
      expect(VersionValidator.isValidVersion('V1_6')).toBe(false); // 低于最低版本
    });
  });

  describe('VersionValidator.getMinimumVersionString() 测试', () => {
    it('应该返回正确的最低版本字符串', () => {
      const minVersion = VersionValidator.getMinimumVersionString();
      
      expect(minVersion).toBe('V1_7');
    });

    it('应该返回与常量一致的版本字符串', () => {
      const minVersion = VersionValidator.getMinimumVersionString();
      const expectedVersion = `V${VersionValidator.MAJOR_VERSION}_${VersionValidator.MINOR_VERSION}`;
      
      expect(minVersion).toBe(expectedVersion);
    });
  });

  describe('VersionValidator.compareVersions() 测试', () => {
    
    describe('主版本号比较测试', () => {
      it('应该正确比较主版本号大的情况', () => {
        const version1 = new DeviceVersion(2, 0, true, 'V2_0');
        const version2 = new DeviceVersion(1, 9, true, 'V1_9');
        
        const result = VersionValidator.compareVersions(version1, version2);
        expect(result).toBe(1);
      });

      it('应该正确比较主版本号小的情况', () => {
        const version1 = new DeviceVersion(1, 9, true, 'V1_9');
        const version2 = new DeviceVersion(2, 0, true, 'V2_0');
        
        const result = VersionValidator.compareVersions(version1, version2);
        expect(result).toBe(-1);
      });
    });

    describe('次版本号比较测试', () => {
      it('应该正确比较相同主版本号下次版本号大的情况', () => {
        const version1 = new DeviceVersion(1, 8, true, 'V1_8');
        const version2 = new DeviceVersion(1, 7, true, 'V1_7');
        
        const result = VersionValidator.compareVersions(version1, version2);
        expect(result).toBe(1);
      });

      it('应该正确比较相同主版本号下次版本号小的情况', () => {
        const version1 = new DeviceVersion(1, 6, false, 'V1_6');
        const version2 = new DeviceVersion(1, 7, true, 'V1_7');
        
        const result = VersionValidator.compareVersions(version1, version2);
        expect(result).toBe(-1);
      });
    });

    describe('版本相等测试', () => {
      it('应该正确识别完全相同的版本', () => {
        const version1 = new DeviceVersion(1, 7, true, 'V1_7');
        const version2 = new DeviceVersion(1, 7, true, 'V1_7');
        
        const result = VersionValidator.compareVersions(version1, version2);
        expect(result).toBe(0);
      });

      it('应该正确识别数值相同但有效性不同的版本', () => {
        const version1 = new DeviceVersion(1, 7, true, 'V1_7');
        const version2 = new DeviceVersion(1, 7, false, 'V1_7_invalid');
        
        const result = VersionValidator.compareVersions(version1, version2);
        expect(result).toBe(0);
      });

      it('应该正确识别数值相同但字符串不同的版本', () => {
        const version1 = new DeviceVersion(1, 7, true, 'V1_7');
        const version2 = new DeviceVersion(1, 7, true, '1.7');
        
        const result = VersionValidator.compareVersions(version1, version2);
        expect(result).toBe(0);
      });
    });

    describe('复杂版本比较测试', () => {
      it('应该正确比较零版本', () => {
        const version1 = new DeviceVersion(0, 0, false, '');
        const version2 = new DeviceVersion(1, 0, true, 'V1_0');
        
        const result = VersionValidator.compareVersions(version1, version2);
        expect(result).toBe(-1);
      });

      it('应该正确比较大版本号', () => {
        const version1 = new DeviceVersion(10, 25, true, 'V10_25');
        const version2 = new DeviceVersion(9, 99, true, 'V9_99');
        
        const result = VersionValidator.compareVersions(version1, version2);
        expect(result).toBe(1);
      });

      it('应该正确比较次版本号为0的情况', () => {
        const version1 = new DeviceVersion(2, 0, true, 'V2_0');
        const version2 = new DeviceVersion(1, 999, true, 'V1_999');
        
        const result = VersionValidator.compareVersions(version1, version2);
        expect(result).toBe(1);
      });
    });
  });

  describe('DeviceConnectionException 测试', () => {
    it('应该正确创建异常对象', () => {
      const exception = new DeviceConnectionException('测试异常');
      
      expect(exception.message).toBe('测试异常');
      expect(exception.name).toBe('DeviceConnectionException');
      expect(exception.deviceVersion).toBeUndefined();
      expect(exception instanceof Error).toBe(true);
    });

    it('应该正确创建带版本信息的异常对象', () => {
      const exception = new DeviceConnectionException('版本不兼容', 'V1_6');
      
      expect(exception.message).toBe('版本不兼容');
      expect(exception.name).toBe('DeviceConnectionException');
      expect(exception.deviceVersion).toBe('V1_6');
      expect(exception instanceof Error).toBe(true);
    });

    it('应该正确处理空字符串消息', () => {
      const exception = new DeviceConnectionException('', 'V2_0');
      
      expect(exception.message).toBe('');
      expect(exception.name).toBe('DeviceConnectionException');
      expect(exception.deviceVersion).toBe('V2_0');
    });

    it('应该正确继承Error类的属性', () => {
      const exception = new DeviceConnectionException('继承测试');
      
      expect(exception.stack).toBeDefined();
      expect(exception.toString()).toContain('DeviceConnectionException');
      expect(exception.toString()).toContain('继承测试');
    });
  });

  describe('集成测试', () => {
    it('应该能够处理完整的版本验证流程', () => {
      // 模拟设备返回版本字符串
      const deviceVersionString = 'LOGIC_ANALYZER_V1_8_STABLE';
      
      // 解析版本
      const version = VersionValidator.getVersion(deviceVersionString);
      
      // 验证解析结果
      expect(version.major).toBe(1);
      expect(version.minor).toBe(8);
      expect(version.isValid).toBe(true);
      
      // 验证便捷方法
      expect(VersionValidator.isValidVersion(deviceVersionString)).toBe(true);
      
      // 比较版本
      const minimumVersion = new DeviceVersion(
        VersionValidator.MAJOR_VERSION, 
        VersionValidator.MINOR_VERSION, 
        true, 
        VersionValidator.getMinimumVersionString()
      );
      
      expect(VersionValidator.compareVersions(version, minimumVersion)).toBe(1);
    });

    it('应该能够处理不兼容版本的完整流程', () => {
      const deviceVersionString = 'OLD_DEVICE_V1_5';
      
      const version = VersionValidator.getVersion(deviceVersionString);
      
      expect(version.isValid).toBe(false);
      expect(VersionValidator.isValidVersion(deviceVersionString)).toBe(false);
      
      // 模拟抛出异常
      if (!version.isValid) {
        const exception = new DeviceConnectionException(
          `设备版本 ${version.versionString} 不兼容，最低要求版本 ${VersionValidator.getMinimumVersionString()}`,
          version.versionString
        );
        
        expect(exception.deviceVersion).toBe(deviceVersionString);
        expect(exception.message).toContain('不兼容');
      }
    });
  });

  describe('性能和压力测试', () => {
    it('应该能够快速处理大量版本验证', () => {
      const testVersions = [
        'V1_7', 'V1_8', 'V2_0', 'V1_6', '1.7', '1.8', '2.0', '1.6',
        'LOGIC_V1_7', 'DEVICE_V2_1', 'invalid', '', null, undefined
      ];
      
      const startTime = performance.now();
      
      testVersions.forEach(versionString => {
        VersionValidator.getVersion(versionString as any);
        VersionValidator.isValidVersion(versionString as any);
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // 性能要求：处理多个版本应该在10ms内完成
      expect(duration).toBeLessThan(10);
    });

    it('应该能够处理长字符串版本', () => {
      const longVersionString = 'VERY_LONG_DEVICE_NAME_WITH_LOTS_OF_TEXT_V1_8_FINAL_RELEASE_BUILD_12345';
      
      const version = VersionValidator.getVersion(longVersionString);
      
      expect(version.major).toBe(1);
      expect(version.minor).toBe(8);
      expect(version.isValid).toBe(true);
      expect(version.versionString).toBe(longVersionString);
    });
  });
});