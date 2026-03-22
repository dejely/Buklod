export type PermissionState = 'unknown' | 'granted' | 'denied';

export type HubStatus = 'hosting' | 'joined' | 'discovered';

export type ConnectedPeer = {
  endpointId: string;
  endpointName: string;
  connectedAt: number;
  hubMetadata?: string | null;
};

export type HubIdentity = {
  hubId: string;
  hubName: string;
  creatorNodeId: string;
  createdAt: number;
  membersKnown?: string[];
};

export type CurrentHub = HubIdentity & {
  status: Exclude<HubStatus, 'discovered'>;
};

export type DiscoveredHub = HubIdentity & {
  endpointName: string;
  viaEndpointId: string;
  advertisingNodeId: string;
  lastSeenAt: number;
  reachableEndpointIds: string[];
  status: HubStatus;
};

export type HubAnnouncementPayload = {
  type: 'HUB_ANNOUNCE';
  hubId: string;
  hubName: string;
  creatorNodeId: string;
  createdAt: number;
  nodeId: string;
};

export type HubMessagePayload = {
  type: 'HUB_MESSAGE';
  messageId: string;
  hubId: string;
  originNodeId: string;
  currentSenderNodeId: string;
  senderName: string;
  text: string;
  createdAt: number;
  ttl: number;
  hopCount: number;
};

export type HubSyncRequestPayload = {
  type: 'HUB_SYNC_REQUEST';
  hubId: string;
  requestNodeId: string;
  sinceTimestamp: number;
};

export type HubSyncResponsePayload = {
  type: 'HUB_SYNC_RESPONSE';
  hubId: string;
  messages: HubMessagePayload[];
};

export type HubPayload =
  | HubAnnouncementPayload
  | HubMessagePayload
  | HubSyncRequestPayload
  | HubSyncResponsePayload;

export type HubMessageRecord = HubMessagePayload & {
  id: string;
  direction: 'sent' | 'received';
  receivedFromEndpointId: string | null;
  displayedAt: number;
};

export type DebugLog = {
  id: string;
  createdAt: number;
  message: string;
  tone?: 'default' | 'success' | 'warning';
};
