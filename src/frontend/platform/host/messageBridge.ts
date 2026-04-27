import type { HostInboundMessage } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeHostMessage(raw: unknown): HostInboundMessage | null {
  if (!isRecord(raw) || typeof raw.type !== 'string') {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'payload')) {
    return {
      type: raw.type,
      payload: raw.payload,
      raw
    };
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'data')) {
    return {
      type: raw.type,
      payload: raw.data,
      raw
    };
  }

  if (raw.type === 'error' && typeof raw.message === 'string') {
    return {
      type: raw.type,
      payload: { message: raw.message },
      raw
    };
  }

  return {
    type: raw.type,
    raw
  };
}
