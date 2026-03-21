import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import {
  acceptConnection,
  addNearbyListener,
  disconnect,
  isNearbyConnectionsAvailable,
  requestConnection,
  sendPayloadToMany,
  startAdvertising as nativeStartAdvertising,
  startDiscovery as nativeStartDiscovery,
  stopAdvertising as nativeStopAdvertising,
  stopDiscovery as nativeStopDiscovery,
  type NearbyConnectionInitiatedEvent,
  type NearbyConnectionRejectedEvent,
  type NearbyConnectionStateEvent,
  type NearbyEndpointFoundEvent,
  type NearbyEndpointLostEvent,
  type NearbyLogEvent,
  type NearbyPayloadReceivedEvent,
} from '@/modules/expo-nearby-connections';
import type {
  ConnectedPeer,
  DebugLog,
  DiscoveredEndpoint,
  MeshMessage,
  MeshMessageRecord,
} from './types';

const SERVICE_ID = 'offline-mesh-chat-v1';
const DEFAULT_TTL = 3;
const MAX_LOGS = 120;
const MAX_MESSAGES = 80;
const MAX_SEEN_MESSAGES = 512;

const ANDROID_PERMISSIONS = {
  ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
  BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
  BLUETOOTH_ADVERTISE: 'android.permission.BLUETOOTH_ADVERTISE',
  BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
  NEARBY_WIFI_DEVICES: 'android.permission.NEARBY_WIFI_DEVICES',
};

function createLocalId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function trimNewest<T>(items: T[], maxSize: number) {
  if (items.length <= maxSize) {
    return items;
  }

  return items.slice(items.length - maxSize);
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
}

function parseMeshMessage(raw: string): MeshMessage | null {
  try {
    const parsed = JSON.parse(raw);

    if (
      typeof parsed.messageId !== 'string' ||
      typeof parsed.originNodeId !== 'string' ||
      typeof parsed.currentSenderNodeId !== 'string' ||
      typeof parsed.text !== 'string' ||
      typeof parsed.ttl !== 'number' ||
      typeof parsed.hopCount !== 'number' ||
      typeof parsed.createdAt !== 'number'
    ) {
      return null;
    }

    return {
      messageId: parsed.messageId,
      originNodeId: parsed.originNodeId,
      currentSenderNodeId: parsed.currentSenderNodeId,
      text: parsed.text,
      ttl: parsed.ttl,
      hopCount: parsed.hopCount,
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

async function requestNearbyRuntimePermissions(): Promise<{
  granted: boolean;
  results: Record<string, string>;
}> {
  if (Platform.OS !== 'android') {
    return { granted: false, results: {} };
  }

  type AndroidPermission =
    (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS];
  type AndroidPermissionStatus =
    (typeof PermissionsAndroid.RESULTS)[keyof typeof PermissionsAndroid.RESULTS];

  const permissions: AndroidPermission[] = [
    ANDROID_PERMISSIONS.ACCESS_FINE_LOCATION as AndroidPermission,
  ];
  const sdkVersion = Number(Platform.Version);

  if (sdkVersion >= 31) {
    permissions.push(
      ANDROID_PERMISSIONS.BLUETOOTH_SCAN as AndroidPermission,
      ANDROID_PERMISSIONS.BLUETOOTH_ADVERTISE as AndroidPermission,
      ANDROID_PERMISSIONS.BLUETOOTH_CONNECT as AndroidPermission
    );
  }

  if (sdkVersion >= 33) {
    permissions.push(ANDROID_PERMISSIONS.NEARBY_WIFI_DEVICES as AndroidPermission);
  }

  const results = await PermissionsAndroid.requestMultiple(permissions);
  const indexedResults = results as Record<string, AndroidPermissionStatus>;
  const granted = permissions.every(
    (permission) => indexedResults[permission] === PermissionsAndroid.RESULTS.GRANTED
  );

  return { granted, results: indexedResults };
}

export function useMeshChat() {
  const [nodeId] = useState(() => createLocalId('node'));
  const [draft, setDraft] = useState('');
  const [advertising, setAdvertising] = useState(false);
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied'>(
    'unknown'
  );
  const [discoveredEndpoints, setDiscoveredEndpoints] = useState<DiscoveredEndpoint[]>([]);
  const [connectedPeers, setConnectedPeers] = useState<ConnectedPeer[]>([]);
  const [messages, setMessages] = useState<MeshMessageRecord[]>([]);
  const [logs, setLogs] = useState<DebugLog[]>([]);

  const available = Platform.OS === 'android' && isNearbyConnectionsAvailable();
  const seenMessagesRef = useRef(new Map<string, number>());
  const connectedPeersRef = useRef<ConnectedPeer[]>([]);
  const endpointNamesRef = useRef(new Map<string, string>());

  const appendLog = useCallback((message: string) => {
    setLogs((current) =>
      trimNewest(
        [
          ...current,
          {
            id: createLocalId('log'),
            createdAt: Date.now(),
            message,
          },
        ],
        MAX_LOGS
      )
    );
  }, []);

  const syncConnectedPeers = useCallback(
    (updater: (current: ConnectedPeer[]) => ConnectedPeer[]) => {
      setConnectedPeers((current) => {
        const next = updater(current);
        connectedPeersRef.current = next;
        return next;
      });
    },
    []
  );

  const upsertDiscoveredEndpoint = useCallback((event: NearbyEndpointFoundEvent) => {
    endpointNamesRef.current.set(event.endpointId, event.endpointName);

    setDiscoveredEndpoints((current) => {
      const nextEndpoint: DiscoveredEndpoint = {
        endpointId: event.endpointId,
        endpointName: event.endpointName,
        serviceId: event.serviceId,
        discoveredAt: Date.now(),
      };
      const index = current.findIndex((item) => item.endpointId === event.endpointId);

      if (index === -1) {
        return [nextEndpoint, ...current];
      }

      const next = [...current];
      next[index] = nextEndpoint;
      return next;
    });
  }, []);

  const removeDiscoveredEndpoint = useCallback((endpointId: string) => {
    setDiscoveredEndpoints((current) =>
      current.filter((endpoint) => endpoint.endpointId !== endpointId)
    );
  }, []);

  const upsertConnectedPeer = useCallback(
    (event: NearbyConnectionStateEvent) => {
      const endpointName =
        event.endpointName || endpointNamesRef.current.get(event.endpointId) || event.endpointId;

      endpointNamesRef.current.set(event.endpointId, endpointName);
      removeDiscoveredEndpoint(event.endpointId);

      syncConnectedPeers((current) => {
        const nextPeer: ConnectedPeer = {
          endpointId: event.endpointId,
          endpointName,
          connectedAt: Date.now(),
        };
        const index = current.findIndex((peer) => peer.endpointId === event.endpointId);

        if (index === -1) {
          return [nextPeer, ...current];
        }

        const next = [...current];
        next[index] = nextPeer;
        return next;
      });
    },
    [removeDiscoveredEndpoint, syncConnectedPeers]
  );

  const removeConnectedPeer = useCallback((endpointId: string) => {
    syncConnectedPeers((current) => current.filter((peer) => peer.endpointId !== endpointId));
  }, [syncConnectedPeers]);

  const rememberSeenMessage = useCallback((messageId: string) => {
    const seen = seenMessagesRef.current;
    seen.set(messageId, Date.now());

    while (seen.size > MAX_SEEN_MESSAGES) {
      const oldestKey = seen.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      seen.delete(oldestKey);
    }
  }, []);

  const appendMessage = useCallback((message: MeshMessageRecord) => {
    setMessages((current) => trimNewest([...current, message], MAX_MESSAGES));
  }, []);

  useEffect(() => {
    if (!available) {
      appendLog('Nearby Connections module is unavailable. Use an Android development build.');
      return;
    }

    const endpointFoundSub = addNearbyListener('onEndpointFound', (event) => {
      appendLog(`Discovered ${event.endpointName} (${event.endpointId})`);
      upsertDiscoveredEndpoint(event);
    });

    const endpointLostSub = addNearbyListener('onEndpointLost', (event: NearbyEndpointLostEvent) => {
      appendLog(`Lost endpoint ${event.endpointId}`);
      removeDiscoveredEndpoint(event.endpointId);
    });

    const connectionInitiatedSub = addNearbyListener(
      'onConnectionInitiated',
      (event: NearbyConnectionInitiatedEvent) => {
        endpointNamesRef.current.set(event.endpointId, event.endpointName);
        appendLog(
          `Connection initiated with ${event.endpointName} (${event.endpointId}), auto-accepting`
        );
        void acceptConnection(event.endpointId).catch((error) => {
          appendLog(`Accept connection failed for ${event.endpointId}: ${toErrorMessage(error)}`);
        });
      }
    );

    const connectionAcceptedSub = addNearbyListener(
      'onConnectionAccepted',
      (event: NearbyConnectionStateEvent) => {
        upsertConnectedPeer(event);
        appendLog(`Connection accepted with ${event.endpointName ?? event.endpointId}`);
      }
    );

    const connectionRejectedSub = addNearbyListener(
      'onConnectionRejected',
      (event: NearbyConnectionRejectedEvent) => {
        appendLog(
          `Connection rejected for ${event.endpointId}: ${
            event.statusMessage ?? String(event.statusCode ?? 'unknown')
          }`
        );
        removeConnectedPeer(event.endpointId);
      }
    );

    const connectionDisconnectedSub = addNearbyListener(
      'onConnectionDisconnected',
      (event: NearbyConnectionStateEvent) => {
        appendLog(`Disconnected from ${event.endpointName ?? event.endpointId}`);
        removeConnectedPeer(event.endpointId);
      }
    );

    const payloadReceivedSub = addNearbyListener(
      'onPayloadReceived',
      (event: NearbyPayloadReceivedEvent) => {
        appendLog(`Payload received from ${event.endpointId}: ${event.bytes}`);

        const message = parseMeshMessage(event.bytes);
        if (!message) {
          appendLog(`Dropped malformed payload from ${event.endpointId}`);
          return;
        }

        if (seenMessagesRef.current.has(message.messageId)) {
          appendLog(`Dropped duplicate message ${message.messageId}`);
          return;
        }

        rememberSeenMessage(message.messageId);

        appendMessage({
          ...message,
          id: message.messageId,
          direction: 'received',
          receivedFromEndpointId: event.endpointId,
          displayedAt: Date.now(),
        });

        const nextTtl = message.ttl - 1;
        const nextHopCount = message.hopCount + 1;
        const forwardTargets = connectedPeersRef.current
          .map((peer) => peer.endpointId)
          .filter((endpointId) => endpointId !== event.endpointId);

        if (nextTtl <= 0) {
          appendLog(`Not forwarding ${message.messageId}: ttl exhausted`);
          return;
        }

        if (forwardTargets.length === 0) {
          appendLog(`Not forwarding ${message.messageId}: no alternate peers`);
          return;
        }

        const forwardedMessage: MeshMessage = {
          ...message,
          currentSenderNodeId: nodeId,
          ttl: nextTtl,
          hopCount: nextHopCount,
        };

        void sendPayloadToMany(forwardTargets, JSON.stringify(forwardedMessage))
          .then(() => {
            appendLog(
              `Forwarded ${message.messageId} to ${forwardTargets.join(
                ', '
              )} ttl=${forwardedMessage.ttl} hopCount=${forwardedMessage.hopCount}`
            );
          })
          .catch((error) => {
            appendLog(`Forwarding failed for ${message.messageId}: ${toErrorMessage(error)}`);
          });
      }
    );

    const logSub = addNearbyListener('onLog', (event: NearbyLogEvent) => {
      appendLog(`native: ${event.message}`);
    });

    return () => {
      endpointFoundSub.remove();
      endpointLostSub.remove();
      connectionInitiatedSub.remove();
      connectionAcceptedSub.remove();
      connectionRejectedSub.remove();
      connectionDisconnectedSub.remove();
      payloadReceivedSub.remove();
      logSub.remove();
    };
  }, [
    appendLog,
    appendMessage,
    available,
    nodeId,
    rememberSeenMessage,
    removeConnectedPeer,
    removeDiscoveredEndpoint,
    upsertConnectedPeer,
    upsertDiscoveredEndpoint,
  ]);

  const ensurePermissions = async () => {
    if (!available) {
      return false;
    }

    const { granted, results } = await requestNearbyRuntimePermissions();

    Object.entries(results).forEach(([permission, result]) => {
      appendLog(`Permission ${permission}: ${result}`);
    });

    setPermissionState(granted ? 'granted' : 'denied');

    if (!granted) {
      appendLog('Nearby permissions were denied.');
    }

    return granted;
  };

  const startAdvertising = async () => {
    if (!available) {
      appendLog('Cannot start advertising outside Android development builds.');
      return;
    }

    if (!(await ensurePermissions())) {
      return;
    }

    try {
      await nativeStartAdvertising(SERVICE_ID, nodeId);
      setAdvertising(true);
      appendLog(`Advertising as ${nodeId}`);
    } catch (error) {
      appendLog(`Start advertising failed: ${toErrorMessage(error)}`);
    }
  };

  const startDiscovery = async () => {
    if (!available) {
      appendLog('Cannot start discovery outside Android development builds.');
      return;
    }

    if (!(await ensurePermissions())) {
      return;
    }

    try {
      await nativeStartDiscovery(SERVICE_ID);
      appendLog(`Discovery started for ${SERVICE_ID}`);
    } catch (error) {
      appendLog(`Start discovery failed: ${toErrorMessage(error)}`);
    }
  };

  const stopAll = async () => {
    if (!available) {
      return;
    }

    try {
      await nativeStopAdvertising();
      await nativeStopDiscovery();

      const currentPeers = [...connectedPeersRef.current];
      for (const peer of currentPeers) {
        await disconnect(peer.endpointId);
      }

      setAdvertising(false);
      setDiscoveredEndpoints([]);
      syncConnectedPeers(() => []);
      appendLog('Stopped advertising/discovery and disconnected all peers');
    } catch (error) {
      appendLog(`Stop failed: ${toErrorMessage(error)}`);
    }
  };

  const connectToEndpoint = async (endpointId: string) => {
    if (!available) {
      return;
    }

    const endpointName = endpointNamesRef.current.get(endpointId) ?? endpointId;
    appendLog(`Requesting connection to ${endpointName}`);

    try {
      await requestConnection(endpointId, nodeId);
    } catch (error) {
      appendLog(`Request connection failed for ${endpointName}: ${toErrorMessage(error)}`);
    }
  };

  const disconnectPeer = async (endpointId: string) => {
    if (!available) {
      return;
    }

    try {
      await disconnect(endpointId);
      removeConnectedPeer(endpointId);
    } catch (error) {
      appendLog(`Disconnect failed for ${endpointId}: ${toErrorMessage(error)}`);
    }
  };

  const sendMessage = async () => {
    const text = draft.trim();

    if (!text) {
      return;
    }

    const targetEndpointIds = connectedPeersRef.current.map((peer) => peer.endpointId);

    if (targetEndpointIds.length === 0) {
      appendLog('No connected peers available for sending.');
      return;
    }

    const message: MeshMessage = {
      messageId: createLocalId('msg'),
      originNodeId: nodeId,
      currentSenderNodeId: nodeId,
      text,
      ttl: DEFAULT_TTL,
      hopCount: 0,
      createdAt: Date.now(),
    };

    rememberSeenMessage(message.messageId);
    appendMessage({
      ...message,
      id: message.messageId,
      direction: 'sent',
      receivedFromEndpointId: null,
      displayedAt: Date.now(),
    });

    try {
      await sendPayloadToMany(targetEndpointIds, JSON.stringify(message));
      appendLog(
        `Sent ${message.messageId} to ${targetEndpointIds.join(
          ', '
        )} ttl=${message.ttl} hopCount=${message.hopCount}`
      );
      setDraft('');
    } catch (error) {
      appendLog(`Send failed: ${toErrorMessage(error)}`);
    }
  };

  return {
    advertising,
    available,
    connectToEndpoint,
    connectedPeers,
    disconnectPeer,
    discoveredEndpoints,
    draft,
    logs,
    messages,
    nodeId,
    permissionState,
    sendMessage,
    serviceId: SERVICE_ID,
    setDraft,
    startAdvertising,
    startDiscovery,
    stopAll,
  };
}
