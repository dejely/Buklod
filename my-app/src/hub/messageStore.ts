import type { DebugLog, HubMessagePayload, HubMessageRecord } from './types';

export function createLocalId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function trimNewest<T>(items: T[], maxSize: number) {
  if (items.length <= maxSize) {
    return items;
  }

  return items.slice(items.length - maxSize);
}

export function createDebugLog(
  message: string,
  tone: DebugLog['tone'] = 'default'
): DebugLog {
  return {
    id: createLocalId('log'),
    createdAt: Date.now(),
    message,
    tone,
  };
}

export function hasSeenMessage(cache: Map<string, number>, messageId: string) {
  return cache.has(messageId);
}

export function rememberSeenMessage(
  cache: Map<string, number>,
  messageId: string,
  maxSize: number
) {
  cache.set(messageId, Date.now());

  while (cache.size > maxSize) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    cache.delete(oldestKey);
  }
}

export function createHubMessageRecord(
  payload: HubMessagePayload,
  direction: HubMessageRecord['direction'],
  receivedFromEndpointId: string | null
): HubMessageRecord {
  return {
    ...payload,
    id: payload.messageId,
    direction,
    receivedFromEndpointId,
    displayedAt: Date.now(),
  };
}

export function storeMessageRecord(
  store: Map<string, HubMessageRecord[]>,
  record: HubMessageRecord,
  maxSize: number
) {
  const current = store.get(record.hubId) ?? [];
  if (current.some((item) => item.messageId === record.messageId)) {
    return current;
  }

  const next = trimNewest([...current, record], maxSize);
  store.set(record.hubId, next);
  return next;
}

export function getHubMessageRecords(
  store: Map<string, HubMessageRecord[]>,
  hubId: string
) {
  return [...(store.get(hubId) ?? [])];
}

export function getHubMessagePayloadsSince(
  store: Map<string, HubMessageRecord[]>,
  hubId: string,
  sinceTimestamp: number
): HubMessagePayload[] {
  return getHubMessageRecords(store, hubId)
    .filter((record) => record.createdAt >= sinceTimestamp)
    .map(
      ({
        id: _id,
        direction: _direction,
        receivedFromEndpointId: _receivedFromEndpointId,
        displayedAt: _displayedAt,
        ...payload
      }) => payload
    );
}
