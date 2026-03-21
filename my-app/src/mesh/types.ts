export type DiscoveredEndpoint = {
  endpointId: string;
  endpointName: string;
  serviceId?: string;
  discoveredAt: number;
};

export type ConnectedPeer = {
  endpointId: string;
  endpointName: string;
  connectedAt: number;
};

export type MeshMessage = {
  messageId: string;
  originNodeId: string;
  currentSenderNodeId: string;
  text: string;
  ttl: number;
  hopCount: number;
  createdAt: number;
};

export type MeshMessageRecord = MeshMessage & {
  id: string;
  direction: 'sent' | 'received';
  receivedFromEndpointId: string | null;
  displayedAt: number;
};

export type DebugLog = {
  id: string;
  createdAt: number;
  message: string;
};
