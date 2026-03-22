import type { EventSubscription } from 'expo-modules-core';

import ExpoNearbyConnectionsModule from './ExpoNearbyConnectionsModule';
import type {
  NearbyConnectedPeerSnapshot,
  NearbyConnectionInitiatedEvent,
  NearbyConnectionRejectedEvent,
  NearbyConnectionStateEvent,
  NearbyConnectionsModuleEvents,
  NearbyEndpointFoundEvent,
  NearbyEndpointLostEvent,
  NearbyPayloadReceivedEvent,
  NearbyTransportLogEvent,
} from './ExpoNearbyConnections.types';

function getModule() {
  if (!ExpoNearbyConnectionsModule) {
    throw new Error(
      'ExpoNearbyConnections is unavailable. Use an Android Expo development build instead of Expo Go.'
    );
  }

  return ExpoNearbyConnectionsModule;
}

export function isNearbyConnectionsAvailable(): boolean {
  return !!ExpoNearbyConnectionsModule;
}

export function addNearbyListener<EventName extends keyof NearbyConnectionsModuleEvents>(
  eventName: EventName,
  listener: NearbyConnectionsModuleEvents[EventName]
): EventSubscription {
  return getModule().addListener(
    eventName,
    listener as unknown as (event: unknown) => void
  );
}

export function startAdvertising(
  serviceId: string,
  nodeName: string,
  hubMetadata?: string
): Promise<void> {
  return getModule().startAdvertising(serviceId, nodeName, hubMetadata);
}

export function stopAdvertising(): Promise<void> {
  return getModule().stopAdvertising();
}

export function startDiscovery(serviceId: string): Promise<void> {
  return getModule().startDiscovery(serviceId);
}

export function stopDiscovery(): Promise<void> {
  return getModule().stopDiscovery();
}

export function requestConnection(endpointId: string, localName: string): Promise<void> {
  return getModule().requestConnection(endpointId, localName);
}

export function acceptConnection(endpointId: string): Promise<void> {
  return getModule().acceptConnection(endpointId);
}

export function rejectConnection(endpointId: string): Promise<void> {
  return getModule().rejectConnection(endpointId);
}

export function disconnect(endpointId: string): Promise<void> {
  return getModule().disconnect(endpointId);
}

export function disconnectAll(): Promise<void> {
  return getModule().disconnectAll();
}

export function sendPayload(endpointId: string, payload: string): Promise<void> {
  return getModule().sendPayload(endpointId, payload);
}

export function sendPayloadToMany(endpointIds: string[], payload: string): Promise<void> {
  return getModule().sendPayloadToMany(endpointIds, payload);
}

export function getConnectedPeers(): Promise<NearbyConnectedPeerSnapshot[]> {
  return getModule().getConnectedPeers();
}

export type {
  NearbyConnectedPeerSnapshot,
  NearbyConnectionInitiatedEvent,
  NearbyConnectionRejectedEvent,
  NearbyConnectionStateEvent,
  NearbyConnectionsModuleEvents,
  NearbyEndpointFoundEvent,
  NearbyEndpointLostEvent,
  NearbyPayloadReceivedEvent,
  NearbyTransportLogEvent,
};
