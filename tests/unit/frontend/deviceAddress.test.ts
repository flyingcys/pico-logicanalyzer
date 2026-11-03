import { getFirstSerialDeviceAddress } from '../../../src/frontend/app/deviceAddress';

describe('设备扫描地址', () => {
  it('应从扫描结果中提取第一个串口设备路径', () => {
    expect(getFirstSerialDeviceAddress([
      {
        type: 'serial',
        connectionPath: '/dev/tty.usbmodem23401',
        connectionString: '/dev/tty.usbmodem23401'
      }
    ])).toBe('/dev/tty.usbmodem23401');
  });
});
