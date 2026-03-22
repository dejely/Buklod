import { createLocalId } from './messageStore';
import type {
  CurrentHub,
  DiscoveredHub,
  HubAnnouncementPayload,
} from './types';

const METADATA_SEPARATOR = '~';
const METADATA_VERSION = 'hubv1';

function encodeValue(value: string) {
  return encodeURIComponent(value);
}

function decodeValue(value: string) {
  return decodeURIComponent(value);
}

function uniqueValues(values: string[] | undefined) {
  return [...new Set((values ?? []).filter(Boolean))];
}

export function createLocalNodeId() {
  return createLocalId('node');
}

export function createLocalNodeName(nodeId: string) {
  return `Relay-${nodeId.slice(-4).toUpperCase()}`;
}

export function createHubRecord(hubName: string, creatorNodeId: string): CurrentHub {
  return {
    hubId: createLocalId('hub'),
    hubName,
    creatorNodeId,
    createdAt: Date.now(),
    membersKnown: [creatorNodeId],
    status: 'hosting',
  };
}

export function buildHubAnnouncement(
  hub: Pick<CurrentHub, 'hubId' | 'hubName' | 'creatorNodeId' | 'createdAt'>,
  nodeId: string
): HubAnnouncementPayload {
  return {
    type: 'HUB_ANNOUNCE',
    hubId: hub.hubId,
    hubName: hub.hubName,
    creatorNodeId: hub.creatorNodeId,
    createdAt: hub.createdAt,
    nodeId,
  };
}

export function serializeAdvertisedHubMetadata(
  announcement: HubAnnouncementPayload
) {
  return [
    METADATA_VERSION,
    encodeValue(announcement.hubId),
    encodeValue(announcement.hubName),
    encodeValue(announcement.creatorNodeId),
    String(announcement.createdAt),
    encodeValue(announcement.nodeId),
  ].join(METADATA_SEPARATOR);
}

export function parseAdvertisedHubMetadata(rawValue?: string | null) {
  if (!rawValue) {
    return null;
  }

  const parts = rawValue.split(METADATA_SEPARATOR);
  if (parts.length !== 6 || parts[0] !== METADATA_VERSION) {
    return null;
  }

  const createdAt = Number(parts[4]);
  if (Number.isNaN(createdAt)) {
    return null;
  }

  return {
    type: 'HUB_ANNOUNCE' as const,
    hubId: decodeValue(parts[1]),
    hubName: decodeValue(parts[2]),
    creatorNodeId: decodeValue(parts[3]),
    createdAt,
    nodeId: decodeValue(parts[5]),
  };
}

export function upsertDiscoveredHub(
  hubs: DiscoveredHub[],
  announcement: HubAnnouncementPayload,
  viaEndpointId: string,
  endpointName: string
) {
  const index = hubs.findIndex((hub) => hub.hubId === announcement.hubId);
  const candidate: DiscoveredHub = {
    hubId: announcement.hubId,
    hubName: announcement.hubName,
    creatorNodeId: announcement.creatorNodeId,
    createdAt: announcement.createdAt,
    membersKnown: [announcement.creatorNodeId, announcement.nodeId],
    status: 'discovered',
    endpointName,
    viaEndpointId,
    advertisingNodeId: announcement.nodeId,
    lastSeenAt: Date.now(),
    reachableEndpointIds: [viaEndpointId],
  };

  if (index === -1) {
    return [candidate, ...hubs];
  }

  const existing = hubs[index];
  const nextHub: DiscoveredHub = {
    ...existing,
    ...candidate,
    membersKnown: uniqueValues([...(existing.membersKnown ?? []), announcement.nodeId]),
    reachableEndpointIds: uniqueValues([
      ...existing.reachableEndpointIds,
      viaEndpointId,
    ]),
  };

  const next = [...hubs];
  next[index] = nextHub;
  return next;
}

export function removeEndpointFromDiscoveredHubs(
  hubs: DiscoveredHub[],
  endpointId: string
) {
  return hubs.flatMap((hub) => {
    const remainingEndpointIds = hub.reachableEndpointIds.filter((item) => item !== endpointId);
    if (remainingEndpointIds.length === 0 && hub.viaEndpointId === endpointId) {
      return [];
    }

    if (!hub.reachableEndpointIds.includes(endpointId)) {
      return [hub];
    }

    return [
      {
        ...hub,
        reachableEndpointIds: remainingEndpointIds,
        viaEndpointId:
          hub.viaEndpointId === endpointId ? remainingEndpointIds[0] ?? hub.viaEndpointId : hub.viaEndpointId,
      },
    ];
  });
}

export function createCurrentHubFromDiscoveredHub(hub: DiscoveredHub): CurrentHub {
  return {
    hubId: hub.hubId,
    hubName: hub.hubName,
    creatorNodeId: hub.creatorNodeId,
    createdAt: hub.createdAt,
    membersKnown: uniqueValues([...(hub.membersKnown ?? []), hub.advertisingNodeId]),
    status: 'joined',
  };
}

export function syncHubMembers(
  hub: CurrentHub,
  memberName: string
): CurrentHub {
  return {
    ...hub,
    membersKnown: uniqueValues([...(hub.membersKnown ?? []), memberName]),
  };
}
