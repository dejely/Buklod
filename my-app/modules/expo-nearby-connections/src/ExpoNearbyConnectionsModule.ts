import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  NearbyConnectedPeerSnapshot,
  NearbyConnectionsModuleEvents,
} from './ExpoNearbyConnections.types';

declare class ExpoNearbyConnectionsModule extends NativeModule<NearbyConnectionsModuleEvents> {
  startAdvertising(serviceId: string, nodeName: string, hubMetadata?: string): Promise<void>;
  stopAdvertising(): Promise<void>;
  startDiscovery(serviceId: string): Promise<void>;
  stopDiscovery(): Promise<void>;
  requestConnection(endpointId: string, localName: string): Promise<void>;
  acceptConnection(endpointId: string): Promise<void>;
  rejectConnection(endpointId: string): Promise<void>;
  disconnect(endpointId: string): Promise<void>;
  disconnectAll(): Promise<void>;
  sendPayload(endpointId: string, payload: string): Promise<void>;
  sendPayloadToMany(endpointIds: string[], payload: string): Promise<void>;
  getConnectedPeers(): Promise<NearbyConnectedPeerSnapshot[]>;
}

export default requireOptionalNativeModule<ExpoNearbyConnectionsModule>('ExpoNearbyConnections');
