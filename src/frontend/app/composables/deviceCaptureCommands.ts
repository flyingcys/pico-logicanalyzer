import type { HostAdapter, HostCommandResult, FrontendDocumentData } from '../../platform/host/types';
import type { useDeviceStore } from '../../core/stores/deviceStore';
import type { useSessionStore } from '../../core/stores/sessionStore';

type DeviceStore = ReturnType<typeof useDeviceStore>;
type SessionStore = ReturnType<typeof useSessionStore>;

interface NotifyAdapter {
  error(message: string): void;
  success?(message: string): void;
}

interface HostResultData {
  capturedDocument?: FrontendDocumentData;
  refreshedDocument?: FrontendDocumentData;
}

export interface DeviceCaptureCommandContext {
  host: HostAdapter;
  deviceStore: DeviceStore;
  sessionStore: SessionStore;
  notify: NotifyAdapter;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readCapturedDocument(data: unknown): FrontendDocumentData | undefined {
  if (!isRecord(data)) {
    return undefined;
  }

  const candidate = (data as HostResultData).capturedDocument ?? (data as HostResultData).refreshedDocument;
  if (
    isRecord(candidate) &&
    typeof candidate.uri === 'string' &&
    typeof candidate.fileName === 'string' &&
    typeof candidate.content === 'string'
  ) {
    return candidate;
  }

  return undefined;
}

function applyResultData(
  result: HostCommandResult,
  deviceStore: DeviceStore,
  sessionStore: SessionStore
): void {
  if (!result.data) {
    return;
  }

  deviceStore.applyStatus(result.data as Parameters<DeviceStore['applyStatus']>[0]);

  const capturedDocument = readCapturedDocument(result.data);
  if (capturedDocument) {
    sessionStore.applyDocument(capturedDocument);
  }
}

function reportFailure(
  result: HostCommandResult,
  deviceStore: DeviceStore,
  notify: NotifyAdapter,
  fallback: string
): void {
  const message = result.error || fallback;
  deviceStore.setError(message);
  notify.error(message);
}

export function createDeviceCaptureCommands({
  host,
  deviceStore,
  sessionStore,
  notify
}: DeviceCaptureCommandContext) {
  const refreshStatus = async (): Promise<HostCommandResult> => {
    const result = await host.sendCommand('getStatus');
    if (result.success) {
      applyResultData(result, deviceStore, sessionStore);
      return result;
    }

    if (result.error) {
      deviceStore.setError(result.error);
    }

    return result;
  };

  const connectDevice = async (payload?: unknown): Promise<HostCommandResult> => {
    deviceStore.setConnecting(true);
    try {
      const result = await host.sendCommand('connectDevice', payload);
      if (!result.success) {
        reportFailure(result, deviceStore, notify, '连接设备失败');
        return result;
      }

      applyResultData(result, deviceStore, sessionStore);
      if (!result.data) {
        await refreshStatus();
      }
      return result;
    } finally {
      deviceStore.setConnecting(false);
    }
  };

  const disconnectDevice = async (): Promise<HostCommandResult> => {
    const result = await host.sendCommand('disconnectDevice');
    if (!result.success) {
      reportFailure(result, deviceStore, notify, '断开失败');
      return result;
    }

    applyResultData(result, deviceStore, sessionStore);
    if (!result.data) {
      deviceStore.applyStatus({
        isConnected: false,
        isCapturing: false
      });
    }
    return result;
  };

  const scanNetworkDevices = async (payload?: unknown): Promise<HostCommandResult> => {
    const result = await host.sendCommand('scanNetworkDevices', payload);
    if (!result.success) {
      reportFailure(result, deviceStore, notify, '网络扫描失败');
    }

    return result;
  };

  const startCapture = async (): Promise<HostCommandResult> => {
    if (!deviceStore.isConnected) {
      const result = {
        success: false,
        error: '请先连接逻辑分析器设备'
      };
      reportFailure(result, deviceStore, notify, result.error);
      return result;
    }

    deviceStore.setCapturing(true);
    try {
      const result = await host.sendCommand('startCapture', {
        config: deviceStore.captureConfig
      });
      if (!result.success) {
        reportFailure(result, deviceStore, notify, '采集失败');
        return result;
      }

      applyResultData(result, deviceStore, sessionStore);
      return result;
    } finally {
      deviceStore.setCapturing(false);
    }
  };

  const stopCapture = async (): Promise<HostCommandResult> => {
    const result = await host.sendCommand('stopCapture');
    if (!result.success) {
      reportFailure(result, deviceStore, notify, '停止采集失败');
      return result;
    }

    applyResultData(result, deviceStore, sessionStore);
    if (!result.data) {
      await refreshStatus();
    }
    return result;
  };

  const repeatCapture = async (): Promise<HostCommandResult> => {
    if (!deviceStore.lastCaptureConfig) {
      const result = {
        success: false,
        error: '没有可重复执行的采集配置'
      };
      reportFailure(result, deviceStore, notify, result.error);
      return result;
    }

    deviceStore.setCapturing(true);
    try {
      const result = await host.sendCommand('repeatCapture');
      if (!result.success) {
        reportFailure(result, deviceStore, notify, '重复采集失败');
        return result;
      }

      applyResultData(result, deviceStore, sessionStore);
      return result;
    } finally {
      deviceStore.setCapturing(false);
    }
  };

  return {
    refreshStatus,
    connectDevice,
    disconnectDevice,
    scanNetworkDevices,
    startCapture,
    stopCapture,
    repeatCapture
  };
}
