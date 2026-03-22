export type NearbyEndpointFoundEvent = {
  endpointId: string;
  endpointName: string;
  serviceId?: string;
  hubMetadata?: string | null;
};

export type NearbyEndpointLostEvent = {
  endpointId: string;
};

export type NearbyConnectionInitiatedEvent = {
  endpointId: string;
  endpointName: string;
  authenticationToken?: string;
  hubMetadata?: string | null;
};

export type NearbyConnectionStateEvent = {
  endpointId: string;
  endpointName?: string;
  hubMetadata?: string | null;
};

export type NearbyConnectionRejectedEvent = NearbyConnectionStateEvent & {
  statusCode?: number;
  statusMessage?: string;
};

export type NearbyPayloadReceivedEvent = {
  endpointId: string;
  payload: string;
};

export type NearbyTransportLogEvent = {
  timestamp: number;
  message: string;
};

export type NearbyConnectedPeerSnapshot = {
  endpointId: string;
  endpointName: string;
  hubMetadata?: string | null;
};

export type NearbyConnectionsModuleEvents = {
  onEndpointFound: (event: NearbyEndpointFoundEvent) => void;
  onEndpointLost: (event: NearbyEndpointLostEvent) => void;
  onConnectionInitiated: (event: NearbyConnectionInitiatedEvent) => void;
  onConnectionAccepted: (event: NearbyConnectionStateEvent) => void;
  onConnectionRejected: (event: NearbyConnectionRejectedEvent) => void;
  onConnectionDisconnected: (event: NearbyConnectionStateEvent) => void;
  onPayloadReceived: (event: NearbyPayloadReceivedEvent) => void;
  onTransportLog: (event: NearbyTransportLogEvent) => void;
};
