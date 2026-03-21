const APP_ID = 'com.dejel.offlinemeshnetwork';

module.exports = {
  expo: {
    name: 'Offline Mesh Network',
    slug: 'offline-mesh-network',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'offlinemeshnetwork',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    // Keep the local Expo module scan explicit so the Nearby wrapper is picked up during prebuild.
    autolinking: {
      nativeModulesDir: './modules',
    },
    ios: {
      bundleIdentifier: APP_ID,
      supportsTablet: false,
    },
    android: {
      package: APP_ID,
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      // Development builds are required because Nearby Connections lives in a custom native module.
      'expo-dev-client',
      './plugins/withNearbyConnections',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#08111f',
          dark: {
            backgroundColor: '#08111f',
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};
