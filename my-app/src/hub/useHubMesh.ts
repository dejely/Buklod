import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  buildHubAnnouncement,
  createCurrentHubFromDiscoveredHub,
  createHubRecord,
  createLocalNodeId,
  createLocalNodeName,
  parseAdvertisedHubMetadata,
  removeEndpointFromDiscoveredHubs,
  serializeAdvertisedHubMetadata,
  syncHubMembers,
  upsertDiscoveredHub,
} from './hubManager';
import {
  createDebugLog,
  createHubMessageRecord,
  getHubMessagePayloadsSince,
  getHubMessageRecords,
  hasSeenMessage,
  rememberSeenMessage,
  storeMessageRecord,
  trimNewest,
} from './messageStore';
import {
  createHubMessagePayload,
  evaluateIncomingHubMessage,
  parseHubPayload,
} from './meshRelay';
import {
  HUB_SERVICE_ID,
  acceptConnection,
  disconnect,
  disconnectAll as nativeDisconnectAll,
  getConnectedPeers,
  isNearbyConnectionsAvailable,
  requestConnection,
  requestNearbyPermissions,
  sendPayload,
  sendPayloadToMany,
  startAdvertising as nativeStartAdvertising,
  startDiscovery as nativeStartDiscovery,
  stopAdvertising as nativeStopAdvertising,
  stopDiscovery as nativeStopDiscovery,
  type NearbyConnectedPeerSnapshot,
  type NearbyConnectionInitiatedEvent,
  type NearbyConnectionRejectedEvent,
  type NearbyConnectionStateEvent,
  type NearbyEndpointFoundEvent,
  type NearbyEndpointLostEvent,
  type NearbyPayloadReceivedEvent,
  type NearbyTransportLogEvent,
} from './nearbyTransport';
import type {
  ConnectedPeer,
  CurrentHub,
  DebugLog,
  DiscoveredHub,
  HubAnnouncementPayload,
  HubMessageRecord,
  HubSyncRequestPayload,
  HubSyncResponsePayload,
  PermissionState,
} from './types';
import { useNearbyEvents } from './useNearbyEvents';

const MAX_LOGS = 180;
const MAX_MESSAGES_PER_HUB = 120;
const MAX_SEEN_MESSAGES = 512;

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
}

function mapNativePeer(peer: NearbyConnectedPeerSnapshot): ConnectedPeer {
  return {
    endpointId: peer.endpointId,
    endpointName: peer.endpointName,
    hubMetadata: peer.hubMetadata,
    connectedAt: Date.now(),
  };
}

export function useHubMesh() {
  const [nodeId] = useState(() => createLocalNodeId());
  const [nodeName] = useState(() => createLocalNodeName(nodeId));
  const [hubNameDraft, setHubNameDraft] = useState('Team Alpha');
  const [messageDraft, setMessageDraft] = useState('');
  const [meshActive, setMeshActive] = useState(false);
  const [advertising, setAdvertising] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [currentHub, setCurrentHubState] = useState<CurrentHub | null>(null);
  const [discoveredHubs, setDiscoveredHubs] = useState<DiscoveredHub[]>([]);
  const [connectedPeers, setConnectedPeers] = useState<ConnectedPeer[]>([]);
  const [messages, setMessages] = useState<HubMessageRecord[]>([]);
  const [logs, setLogs] = useState<DebugLog[]>([]);

  const available = Platform.OS === 'android' && isNearbyConnectionsAvailable();
  const currentHubRef = useRef<CurrentHub | null>(null);
  const connectedPeersRef = useRef<ConnectedPeer[]>([]);
  const seenMessagesRef = useRef(new Map<string, number>());
  const pendingConnectionsRef = useRef(new Set<string>());
  const messageStoreRef = useRef(new Map<string, HubMessageRecord[]>());

  const appendLog = useCallback(
    (message: string, tone: DebugLog['tone'] = 'default') => {
      setLogs((current) => trimNewest([...current, createDebugLog(message, tone)], MAX_LOGS));
    },
    []
  );

  const syncVisibleMessages = useCallback((hubId: string | null) => {
    if (!hubId) {
      setMessages([]);
      return;
    }

    setMessages(getHubMessageRecords(messageStoreRef.current, hubId));
  }, []);

  const setCurrentHub = useCallback(
    (hub: CurrentHub | null) => {
      currentHubRef.current = hub;
      setCurrentHubState(hub);
      syncVisibleMessages(hub?.hubId ?? null);
    },
    [syncVisibleMessages]
  );

  const syncConnectedPeerState = useCallback(
    (updater: (current: ConnectedPeer[]) => ConnectedPeer[]) => {
      setConnectedPeers((current) => {
        const next = updater(current);
        connectedPeersRef.current = next;
        return next;
      });
    },
    []
  );

  const ensurePermissions = useCallback(async () => {
    if (!available) {
      appendLog('Nearby Connections is unavailable. Use an Android development build.', 'warning');
      return false;
    }

    const { granted, results } = await requestNearbyPermissions();
    Object.entries(results).forEach(([permission, result]) => {
      appendLog(`Permission ${permission}: ${result}`);
    });

    setPermissionState(granted ? 'granted' : 'denied');

    if (!granted) {
      appendLog('Required Nearby permissions were denied.', 'warning');
    }

    return granted;
  }, [appendLog, available]);

  const storeRecord = useCallback(
    (record: HubMessageRecord) => {
      const next = storeMessageRecord(
        messageStoreRef.current,
        record,
        MAX_MESSAGES_PER_HUB
      );

      if (currentHubRef.current?.hubId === record.hubId) {
        setMessages(next);
      }
    },
    []
  );

  const advertiseForHub = useCallback(
    async (hub: CurrentHub | null) => {
      const hubMetadata = hub
        ? serializeAdvertisedHubMetadata(buildHubAnnouncement(hub, nodeId))
        : undefined;

      await nativeStartAdvertising(HUB_SERVICE_ID, nodeName, hubMetadata);
      setAdvertising(true);
    },
    [nodeId, nodeName]
  );

  const beginDiscovery = useCallback(async () => {
    await nativeStartDiscovery(HUB_SERVICE_ID);
    setDiscovering(true);
  }, []);

  const requestPeerConnection = useCallback(
    async (endpointId: string, reason: string) => {
      if (
        connectedPeersRef.current.some((peer) => peer.endpointId === endpointId) ||
        pendingConnectionsRef.current.has(endpointId)
      ) {
        return;
      }

      pendingConnectionsRef.current.add(endpointId);

      try {
        await requestConnection(endpointId, nodeName);
        appendLog(`Requested connection to ${endpointId} (${reason})`);
      } catch (error) {
        pendingConnectionsRef.current.delete(endpointId);
        appendLog(
          `Connection request failed for ${endpointId}: ${toErrorMessage(error)}`,
          'warning'
        );
      }
    },
    [appendLog, nodeName]
  );

  const broadcastCurrentHubAnnouncement = useCallback(
    async (targetEndpointIds?: string[]) => {
      const hub = currentHubRef.current;
      if (!hub) {
        return;
      }

      const endpointIds =
        targetEndpointIds && targetEndpointIds.length > 0
          ? targetEndpointIds
          : connectedPeersRef.current.map((peer) => peer.endpointId);

      if (endpointIds.length === 0) {
        return;
      }

      const payload = JSON.stringify(buildHubAnnouncement(hub, nodeId));
      await sendPayloadToMany(endpointIds, payload);
      appendLog(`Broadcast hub announce for ${hub.hubName} to ${endpointIds.length} peer(s)`);
    },
    [appendLog, nodeId]
  );

  const requestHubSync = useCallback(
    async (hub: CurrentHub, targetEndpointIds?: string[]) => {
      const endpointIds =
        targetEndpointIds && targetEndpointIds.length > 0
          ? targetEndpointIds
          : connectedPeersRef.current.map((peer) => peer.endpointId);

      if (endpointIds.length === 0) {
        return;
      }

      const records = getHubMessageRecords(messageStoreRef.current, hub.hubId);
      const sinceTimestamp = records.length > 0 ? records[records.length - 1]!.createdAt : 0;

      const payload: HubSyncRequestPayload = {
        type: 'HUB_SYNC_REQUEST',
        hubId: hub.hubId,
        requestNodeId: nodeId,
        sinceTimestamp,
      };

      await sendPayloadToMany(endpointIds, JSON.stringify(payload));
      appendLog(`Requested sync for ${hub.hubName} from ${endpointIds.length} peer(s)`);
    },
    [appendLog, nodeId]
  );

  const registerDiscoveredHub = useCallback(
    (announcement: HubAnnouncementPayload, endpointId: string, endpointName: string) => {
      if (announcement.nodeId === nodeId) {
        return;
      }

      setDiscoveredHubs((current) =>
        upsertDiscoveredHub(current, announcement, endpointId, endpointName)
      );

      if (currentHubRef.current?.hubId === announcement.hubId) {
        void requestPeerConnection(endpointId, `same hub ${announcement.hubName}`);
      }
    },
    [nodeId, requestPeerConnection]
  );

  const hydrateConnectedPeers = useCallback(async () => {
    try {
      const peers = await getConnectedPeers();
      syncConnectedPeerState(() => peers.map(mapNativePeer));
    } catch (error) {
      appendLog(`Failed to read connected peers: ${toErrorMessage(error)}`, 'warning');
    }
  }, [appendLog, syncConnectedPeerState]);

  useEffect(() => {
    if (!available) {
      appendLog('Nearby transport requires Android Expo development builds.', 'warning');
      return;
    }

    void hydrateConnectedPeers();
  }, [appendLog, available, hydrateConnectedPeers]);

  useNearbyEvents(
    {
      onEndpointFound: (event: NearbyEndpointFoundEvent) => {
        appendLog(`Found endpoint ${event.endpointName} (${event.endpointId})`);

        const announcement = parseAdvertisedHubMetadata(event.hubMetadata);
        if (announcement) {
          registerDiscoveredHub(announcement, event.endpointId, event.endpointName);
        }
      },
      onEndpointLost: (event: NearbyEndpointLostEvent) => {
        appendLog(`Lost endpoint ${event.endpointId}`, 'warning');
        pendingConnectionsRef.current.delete(event.endpointId);
        setDiscoveredHubs((current) =>
          removeEndpointFromDiscoveredHubs(current, event.endpointId)
        );
      },
      onConnectionInitiated: (event: NearbyConnectionInitiatedEvent) => {
        appendLog(
          `Connection initiated with ${event.endpointName} (${event.endpointId}), accepting`
        );
        void acceptConnection(event.endpointId).catch((error) => {
          appendLog(
            `Accept connection failed for ${event.endpointId}: ${toErrorMessage(error)}`,
            'warning'
          );
        });

        const announcement = parseAdvertisedHubMetadata(event.hubMetadata);
        if (announcement) {
          registerDiscoveredHub(announcement, event.endpointId, event.endpointName);
        }
      },
      onConnectionAccepted: (event: NearbyConnectionStateEvent) => {
        pendingConnectionsRef.current.delete(event.endpointId);

        syncConnectedPeerState((current) => {
          const peer: ConnectedPeer = {
            endpointId: event.endpointId,
            endpointName: event.endpointName ?? event.endpointId,
            connectedAt: Date.now(),
            hubMetadata: event.hubMetadata,
          };
          const index = current.findIndex((item) => item.endpointId === event.endpointId);

          if (index === -1) {
            return [peer, ...current];
          }

          const next = [...current];
          next[index] = peer;
          return next;
        });

        const announcement = parseAdvertisedHubMetadata(event.hubMetadata);
        if (announcement) {
          registerDiscoveredHub(
            announcement,
            event.endpointId,
            event.endpointName ?? event.endpointId
          );
        }

        const activeHub = currentHubRef.current;
        if (activeHub) {
          const nextHub = syncHubMembers(activeHub, event.endpointName ?? event.endpointId);
          setCurrentHub(nextHub);
          void broadcastCurrentHubAnnouncement([event.endpointId]);
          void requestHubSync(nextHub, [event.endpointId]);
        }

        appendLog(`Connected to ${event.endpointName ?? event.endpointId}`, 'success');
      },
      onConnectionRejected: (event: NearbyConnectionRejectedEvent) => {
        pendingConnectionsRef.current.delete(event.endpointId);
        appendLog(
          `Connection rejected for ${event.endpointId}: ${
            event.statusMessage ?? String(event.statusCode ?? 'unknown')
          }`,
          'warning'
        );
      },
      onConnectionDisconnected: (event: NearbyConnectionStateEvent) => {
        pendingConnectionsRef.current.delete(event.endpointId);
        syncConnectedPeerState((current) =>
          current.filter((peer) => peer.endpointId !== event.endpointId)
        );
        appendLog(`Disconnected from ${event.endpointName ?? event.endpointId}`, 'warning');
      },
      onPayloadReceived: (event: NearbyPayloadReceivedEvent) => {
        const payload = parseHubPayload(event.payload);
        if (!payload) {
          appendLog(`Dropped malformed payload from ${event.endpointId}`, 'warning');
          return;
        }

        if (payload.type === 'HUB_ANNOUNCE') {
          registerDiscoveredHub(payload, event.endpointId, event.endpointId);
          appendLog(`Hub announce received for ${payload.hubName} from ${event.endpointId}`);
          return;
        }

        if (payload.type === 'HUB_MESSAGE') {
          const alreadySeen = hasSeenMessage(seenMessagesRef.current, payload.messageId);
          const decision = evaluateIncomingHubMessage({
            message: payload,
            currentHubId: currentHubRef.current?.hubId ?? null,
            localNodeId: nodeId,
            fromEndpointId: event.endpointId,
            connectedEndpointIds: connectedPeersRef.current.map((peer) => peer.endpointId),
            alreadySeen,
          });

          if (decision.kind === 'drop') {
            appendLog(
              `Dropped ${payload.messageId} from ${event.endpointId}: ${decision.reason}`,
              decision.reason === 'duplicate' ? 'default' : 'warning'
            );
            return;
          }

          rememberSeenMessage(seenMessagesRef.current, payload.messageId, MAX_SEEN_MESSAGES);

          const record = createHubMessageRecord(payload, 'received', event.endpointId);
          storeRecord(record);
          appendLog(
            `Hub message ${payload.messageId} received ttl=${payload.ttl} hopCount=${payload.hopCount}`
          );

          const forwardedMessage = decision.forwardedMessage;
          if (forwardedMessage && decision.forwardEndpointIds.length > 0) {
            void sendPayloadToMany(
              decision.forwardEndpointIds,
              JSON.stringify(forwardedMessage)
            )
              .then(() => {
                appendLog(
                  `Forwarded ${payload.messageId} to ${decision.forwardEndpointIds.join(
                    ', '
                  )} ttl=${forwardedMessage.ttl} hopCount=${forwardedMessage.hopCount}`,
                  'success'
                );
              })
              .catch((error) => {
                appendLog(
                  `Forwarding failed for ${payload.messageId}: ${toErrorMessage(error)}`,
                  'warning'
                );
              });
          }
          return;
        }

        if (payload.type === 'HUB_SYNC_REQUEST') {
          const activeHub = currentHubRef.current;
          if (!activeHub || payload.hubId !== activeHub.hubId) {
            return;
          }

          const response: HubSyncResponsePayload = {
            type: 'HUB_SYNC_RESPONSE',
            hubId: activeHub.hubId,
            messages: getHubMessagePayloadsSince(
              messageStoreRef.current,
              activeHub.hubId,
              payload.sinceTimestamp
            ),
          };

          void sendPayload(event.endpointId, JSON.stringify(response))
            .then(() => {
              appendLog(
                `Sent sync response with ${response.messages.length} message(s) to ${event.endpointId}`
              );
            })
            .catch((error) => {
              appendLog(`Sync response failed: ${toErrorMessage(error)}`, 'warning');
            });
          return;
        }

        if (payload.type === 'HUB_SYNC_RESPONSE') {
          const activeHub = currentHubRef.current;
          if (!activeHub || payload.hubId !== activeHub.hubId) {
            return;
          }

          let mergedCount = 0;
          payload.messages.forEach((message) => {
            if (hasSeenMessage(seenMessagesRef.current, message.messageId)) {
              return;
            }

            rememberSeenMessage(
              seenMessagesRef.current,
              message.messageId,
              MAX_SEEN_MESSAGES
            );
            storeRecord(createHubMessageRecord(message, 'received', event.endpointId));
            mergedCount += 1;
          });

          appendLog(`Merged ${mergedCount} message(s) from sync response`);
        }
      },
      onTransportLog: (event: NearbyTransportLogEvent) => {
        appendLog(`transport: ${event.message}`);
      },
    },
    available
  );

  const startMesh = useCallback(async () => {
    if (!(await ensurePermissions())) {
      return;
    }

    try {
      await advertiseForHub(currentHubRef.current);
      await beginDiscovery();
      setMeshActive(true);
      appendLog('Mesh started', 'success');
    } catch (error) {
      appendLog(`Unable to start mesh: ${toErrorMessage(error)}`, 'warning');
    }
  }, [advertiseForHub, beginDiscovery, appendLog, ensurePermissions]);

  const stopMesh = useCallback(async () => {
    if (!available) {
      return;
    }

    try {
      await nativeStopAdvertising();
      await nativeStopDiscovery();
      await nativeDisconnectAll();
      setMeshActive(false);
      setAdvertising(false);
      setDiscovering(false);
      setCurrentHub(null);
      setDiscoveredHubs([]);
      syncConnectedPeerState(() => []);
      appendLog('Mesh stopped and all peers disconnected', 'warning');
    } catch (error) {
      appendLog(`Unable to stop mesh: ${toErrorMessage(error)}`, 'warning');
    }
  }, [appendLog, available, setCurrentHub, syncConnectedPeerState]);

  const createHub = useCallback(async () => {
    if (!(await ensurePermissions())) {
      return;
    }

    const nextHub = createHubRecord(hubNameDraft.trim() || 'Team Alpha', nodeId);
    setCurrentHub(nextHub);

    try {
      await advertiseForHub(nextHub);
      await beginDiscovery();
      setMeshActive(true);
      appendLog(`Hub created: ${nextHub.hubName} (${nextHub.hubId})`, 'success');
    } catch (error) {
      appendLog(`Unable to create hub: ${toErrorMessage(error)}`, 'warning');
    }
  }, [
    advertiseForHub,
    appendLog,
    beginDiscovery,
    ensurePermissions,
    hubNameDraft,
    nodeId,
    setCurrentHub,
  ]);

  const discoverHubs = useCallback(async () => {
    if (!(await ensurePermissions())) {
      return;
    }

    try {
      await beginDiscovery();
      setMeshActive(true);

      if (currentHubRef.current && !advertising) {
        await advertiseForHub(currentHubRef.current);
      }

      appendLog('Discovering nearby hubs');
    } catch (error) {
      appendLog(`Unable to discover hubs: ${toErrorMessage(error)}`, 'warning');
    }
  }, [advertiseForHub, advertising, appendLog, beginDiscovery, ensurePermissions]);

  const joinHub = useCallback(
    async (hub: DiscoveredHub) => {
      if (!(await ensurePermissions())) {
        return;
      }

      const nextHub = createCurrentHubFromDiscoveredHub(hub);
      setCurrentHub(nextHub);
      setHubNameDraft(nextHub.hubName);

      try {
        await advertiseForHub(nextHub);
        await beginDiscovery();
        setMeshActive(true);
        appendLog(`Joined hub ${nextHub.hubName}`, 'success');
        await requestPeerConnection(hub.viaEndpointId, `join ${hub.hubName}`);
      } catch (error) {
        appendLog(`Unable to join hub: ${toErrorMessage(error)}`, 'warning');
      }
    },
    [
      advertiseForHub,
      appendLog,
      beginDiscovery,
      ensurePermissions,
      requestPeerConnection,
      setCurrentHub,
    ]
  );

  const disconnectPeer = useCallback(
    async (endpointId: string) => {
      try {
        await disconnect(endpointId);
        syncConnectedPeerState((current) =>
          current.filter((peer) => peer.endpointId !== endpointId)
        );
      } catch (error) {
        appendLog(`Unable to disconnect ${endpointId}: ${toErrorMessage(error)}`, 'warning');
      }
    },
    [appendLog, syncConnectedPeerState]
  );

  const sendMessage = useCallback(async () => {
    const activeHub = currentHubRef.current;
    const text = messageDraft.trim();

    if (!activeHub || !text) {
      return;
    }

    const payload = createHubMessagePayload({
      hubId: activeHub.hubId,
      originNodeId: nodeId,
      senderName: nodeName,
      text,
    });

    rememberSeenMessage(seenMessagesRef.current, payload.messageId, MAX_SEEN_MESSAGES);
    storeRecord(createHubMessageRecord(payload, 'sent', null));
    setMessageDraft('');

    const endpointIds = connectedPeersRef.current.map((peer) => peer.endpointId);
    if (endpointIds.length === 0) {
      appendLog('Stored message locally. Connect peers to relay it.', 'warning');
      return;
    }

    try {
      await sendPayloadToMany(endpointIds, JSON.stringify(payload));
      appendLog(
        `Sent ${payload.messageId} to ${endpointIds.length} peer(s) ttl=${payload.ttl}`,
        'success'
      );
    } catch (error) {
      appendLog(`Unable to send message: ${toErrorMessage(error)}`, 'warning');
    }
  }, [appendLog, messageDraft, nodeId, nodeName, storeRecord]);

  return {
    advertising,
    available,
    connectedPeers,
    currentHub,
    discoveredHubs,
    disconnectPeer,
    discoverHubs,
    discovering,
    hubNameDraft,
    logs,
    meshActive,
    messageDraft,
    messages,
    nodeId,
    nodeName,
    permissionState,
    sendMessage,
    serviceId: HUB_SERVICE_ID,
    setHubNameDraft,
    setMessageDraft,
    startMesh,
    stopMesh,
    createHub,
    joinHub,
  };
}
