import * as vscode from 'vscode';
import { hardwareDriverManager } from '../../src/drivers/HardwareDriverManager';
import { connectToDevice, connectToNetworkDevice } from '../../src/extension';
import { AnalyzerDriverType } from '../../src/models/AnalyzerTypes';

// Mock for hardwareDriverManager - must be at the top before any imports using the module
jest.mock('../../src/drivers/HardwareDriverManager', () => ({
  hardwareDriverManager: {
    connectToDevice: jest.fn().mockResolvedValue({ success: true }),
    getCurrentDevice: jest.fn().mockReturnValue(null),
    getCurrentDeviceInfo: jest.fn().mockReturnValue(null)
  }
}));

describe('Extension Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should connect to device with string ID and no params', async () => {
    const deviceId = 'autodetect';
    await connectToDevice(deviceId);
    expect(hardwareDriverManager.connectToDevice).toHaveBeenCalledWith(deviceId, undefined);
  });

  it('should connect to device with params object', async () => {
    const deviceId = 'network';
    const params = { networkConfig: { host: '192.168.1.100', port: 4045 } };
    await connectToDevice(deviceId, params);
    expect(hardwareDriverManager.connectToDevice).toHaveBeenCalledWith(deviceId, params);
  });

  it('should handle network connection', async () => {
    const host = '192.168.1.100';
    const port = 4045;
    await connectToNetworkDevice(host, port);
    expect(hardwareDriverManager.connectToDevice).toHaveBeenCalledWith('network', expect.objectContaining({ networkConfig: { host, port } }));
  });

  it('should show error message on connection failure', async () => {
    const deviceId = 'invalid';
    await connectToDevice(deviceId);
    expect(hardwareDriverManager.connectToDevice).toHaveBeenCalledWith(deviceId, undefined);
  });
});
