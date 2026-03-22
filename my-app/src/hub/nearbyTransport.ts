import { PermissionsAndroid, Platform } from 'react-native';

import {
  acceptConnection,
  addNearbyListener,
  disconnect,
  disconnectAll,
  getConnectedPeers,
  isNearbyConnectionsAvailable,
  rejectConnection,
  requestConnection,
  sendPayload,
  sendPayloadToMany,
  startAdvertising,
  startDiscovery,
  stopAdvertising,
  stopDiscovery,
  type NearbyConnectedPeerSnapshot,
  type NearbyConnectionInitiatedEvent,
  type NearbyConnectionRejectedEvent,
  type NearbyConnectionStateEvent,
  type NearbyConnectionsModuleEvents,
  type NearbyEndpointFoundEvent,
  type NearbyEndpointLostEvent,
  type NearbyPayloadReceivedEvent,
  type NearbyTransportLogEvent,
} from '@/modules/expo-nearby-connections';

export const HUB_SERVICE_ID = 'offline-hub-mesh-v1';

const ANDROID_PERMISSIONS = {
  ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
  BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
  BLUETOOTH_ADVERTISE: 'android.permission.BLUETOOTH_ADVERTISE',
  BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
  NEARBY_WIFI_DEVICES: 'android.permission.NEARBY_WIFI_DEVICES',
};

export async function requestNearbyPermissions(): Promise<{
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

export {
  acceptConnection,
  addNearbyListener,
  disconnect,
  disconnectAll,
  getConnectedPeers,
  isNearbyConnectionsAvailable,
  rejectConnection,
  requestConnection,
  sendPayload,
  sendPayloadToMany,
  startAdvertising,
  startDiscovery,
  stopAdvertising,
  stopDiscovery,
};

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
