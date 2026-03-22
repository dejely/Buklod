import type {
  HubMessagePayload,
  HubPayload,
  HubSyncRequestPayload,
  HubSyncResponsePayload,
} from './types';

export const DEFAULT_MESSAGE_TTL = 4;

function isHubMessagePayload(payload: unknown): payload is HubMessagePayload {
  const candidate = payload as HubMessagePayload;
  return (
    candidate?.type === 'HUB_MESSAGE' &&
    typeof candidate.messageId === 'string' &&
    typeof candidate.hubId === 'string' &&
    typeof candidate.originNodeId === 'string' &&
    typeof candidate.currentSenderNodeId === 'string' &&
    typeof candidate.senderName === 'string' &&
    typeof candidate.text === 'string' &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.ttl === 'number' &&
    typeof candidate.hopCount === 'number'
  );
}

function isHubSyncRequestPayload(payload: unknown): payload is HubSyncRequestPayload {
  const candidate = payload as HubSyncRequestPayload;
  return (
    candidate?.type === 'HUB_SYNC_REQUEST' &&
    typeof candidate.hubId === 'string' &&
    typeof candidate.requestNodeId === 'string' &&
    typeof candidate.sinceTimestamp === 'number'
  );
}

function isHubSyncResponsePayload(payload: unknown): payload is HubSyncResponsePayload {
  const candidate = payload as HubSyncResponsePayload;
  return (
    candidate?.type === 'HUB_SYNC_RESPONSE' &&
    typeof candidate.hubId === 'string' &&
    Array.isArray(candidate.messages) &&
    candidate.messages.every((message) => isHubMessagePayload(message))
  );
}

export function parseHubPayload(rawPayload: string): HubPayload | null {
  try {
    const parsed = JSON.parse(rawPayload);
    if (
      parsed?.type === 'HUB_ANNOUNCE' &&
      typeof parsed.hubId === 'string' &&
      typeof parsed.hubName === 'string' &&
      typeof parsed.creatorNodeId === 'string' &&
      typeof parsed.createdAt === 'number' &&
      typeof parsed.nodeId === 'string'
    ) {
      return parsed;
    }

    if (isHubMessagePayload(parsed)) {
      return parsed;
    }

    if (isHubSyncRequestPayload(parsed)) {
      return parsed;
    }

    if (isHubSyncResponsePayload(parsed)) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

export function createHubMessagePayload(params: {
  hubId: string;
  originNodeId: string;
  senderName: string;
  text: string;
  ttl?: number;
}) {
  return {
    type: 'HUB_MESSAGE' as const,
    messageId: `${params.originNodeId}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    hubId: params.hubId,
    originNodeId: params.originNodeId,
    currentSenderNodeId: params.originNodeId,
    senderName: params.senderName,
    text: params.text,
    createdAt: Date.now(),
    ttl: params.ttl ?? DEFAULT_MESSAGE_TTL,
    hopCount: 0,
  };
}

export type IncomingHubMessageDecision =
  | {
      kind: 'drop';
      reason: 'duplicate' | 'hub_mismatch' | 'ttl_exhausted' | 'no_peers';
    }
  | {
      kind: 'accept';
      message: HubMessagePayload;
      forwardedMessage?: HubMessagePayload;
      forwardEndpointIds: string[];
    };

export function evaluateIncomingHubMessage(params: {
  message: HubMessagePayload;
  currentHubId: string | null;
  localNodeId: string;
  fromEndpointId: string;
  connectedEndpointIds: string[];
  alreadySeen: boolean;
}): IncomingHubMessageDecision {
  if (params.alreadySeen) {
    return { kind: 'drop', reason: 'duplicate' };
  }

  if (!params.currentHubId || params.message.hubId !== params.currentHubId) {
    return { kind: 'drop', reason: 'hub_mismatch' };
  }

  const nextTtl = params.message.ttl - 1;
  const nextHopCount = params.message.hopCount + 1;
  const forwardEndpointIds = params.connectedEndpointIds.filter(
    (endpointId) => endpointId !== params.fromEndpointId
  );

  if (nextTtl <= 0) {
    return {
      kind: 'accept',
      message: params.message,
      forwardEndpointIds: [],
    };
  }

  if (forwardEndpointIds.length === 0) {
    return {
      kind: 'accept',
      message: params.message,
      forwardEndpointIds: [],
    };
  }

  return {
    kind: 'accept',
    message: params.message,
    forwardedMessage: {
      ...params.message,
      ttl: nextTtl,
      hopCount: nextHopCount,
      currentSenderNodeId: params.localNodeId,
    },
    forwardEndpointIds,
  };
}
