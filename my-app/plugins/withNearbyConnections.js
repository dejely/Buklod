const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
} = require('expo/config-plugins');

const PERMISSIONS = [
  {
    name: 'android.permission.INTERNET',
    comment: 'Helpful for Metro/dev tooling while using a development build.',
  },
  {
    name: 'android.permission.ACCESS_WIFI_STATE',
    comment: 'Nearby Connections can use Wi-Fi transports under the hood.',
  },
  {
    name: 'android.permission.CHANGE_WIFI_STATE',
    comment: 'Allows Nearby Connections to negotiate Wi-Fi based links when needed.',
  },
  {
    name: 'android.permission.BLUETOOTH',
    maxSdkVersion: '30',
    comment: 'Legacy Bluetooth permission for Android 11 and lower.',
  },
  {
    name: 'android.permission.BLUETOOTH_ADMIN',
    maxSdkVersion: '30',
    comment: 'Legacy Bluetooth admin permission for Android 11 and lower.',
  },
  {
    name: 'android.permission.ACCESS_COARSE_LOCATION',
    maxSdkVersion: '30',
    comment: 'Older Android versions gate nearby BLE discovery behind location.',
  },
  {
    name: 'android.permission.ACCESS_FINE_LOCATION',
    comment: 'Requested for reliable nearby discovery on pre-Android 12 devices.',
  },
  {
    name: 'android.permission.BLUETOOTH_SCAN',
    comment: 'Android 12+ runtime permission for nearby device scanning.',
  },
  {
    name: 'android.permission.BLUETOOTH_ADVERTISE',
    comment: 'Android 12+ runtime permission for advertising this device.',
  },
  {
    name: 'android.permission.BLUETOOTH_CONNECT',
    comment: 'Android 12+ runtime permission for establishing peer connections.',
  },
  {
    name: 'android.permission.NEARBY_WIFI_DEVICES',
    comment: 'Android 13+ runtime permission for Wi-Fi based nearby transports.',
  },
];

const FEATURES = [
  {
    name: 'android.hardware.bluetooth',
    required: 'false',
  },
  {
    name: 'android.hardware.bluetooth_le',
    required: 'false',
  },
];

function ensureUsesPermission(manifest, permission) {
  const permissions = manifest.manifest['uses-permission'] ?? [];
  const exists = permissions.some(
    (item) => item.$['android:name'] === permission.name || item.$.name === permission.name
  );

  if (!exists) {
    const nextPermission = {
      $: {
        'android:name': permission.name,
      },
    };

    if (permission.maxSdkVersion) {
      nextPermission.$['android:maxSdkVersion'] = permission.maxSdkVersion;
    }

    permissions.push(nextPermission);
    manifest.manifest['uses-permission'] = permissions;
  }
}

function ensureUsesFeature(manifest, feature) {
  const features = manifest.manifest['uses-feature'] ?? [];
  const exists = features.some((item) => item.$['android:name'] === feature.name);

  if (!exists) {
    features.push({
      $: {
        'android:name': feature.name,
        'android:required': feature.required,
      },
    });
    manifest.manifest['uses-feature'] = features;
  }
}

const withNearbyConnections = (config) =>
  withAndroidManifest(config, (configWithManifest) => {
    const androidManifest = configWithManifest.modResults;
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);

    PERMISSIONS.forEach((permission) => ensureUsesPermission(androidManifest, permission));
    FEATURES.forEach((feature) => ensureUsesFeature(androidManifest, feature));

    // Keep a small metadata marker so it is obvious in the generated manifest that the plugin ran.
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      mainApplication,
      'expo.modules.nearbyconnections.ENABLED',
      'true'
    );

    return configWithManifest;
  });

module.exports = createRunOncePlugin(
  withNearbyConnections,
  'with-nearby-connections',
  '1.0.0'
);
