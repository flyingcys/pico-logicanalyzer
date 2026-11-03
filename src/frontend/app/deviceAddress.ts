export interface DetectedDeviceAddress {
  type?: string;
  connectionPath?: string;
  connectionString?: string;
}

function normalizeAddress(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getFirstSerialDeviceAddress(
  devices: readonly DetectedDeviceAddress[]
): string {
  const serialDevice = devices.find(device => device.type?.toLowerCase() === 'serial');
  if (!serialDevice) {
    return '';
  }

  return normalizeAddress(serialDevice.connectionPath) ||
    normalizeAddress(serialDevice.connectionString);
}
