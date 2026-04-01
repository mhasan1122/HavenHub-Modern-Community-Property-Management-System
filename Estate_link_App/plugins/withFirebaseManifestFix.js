const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * Fix Firebase manifest merger conflict: expo-notifications and react-native-firebase_messaging
 * both define default_notification_color/icon. Add tools:replace to let our values win.
 */
function withFirebaseManifestFix(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest?.application?.[0];

    if (!application) {
      return config;
    }

    // Ensure meta-data array exists
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    const metaData = application['meta-data'];

    // These are the values expo-notifications typically uses or that we want to enforce
    // We assume these resources exist because expo-notifications plugin should have generated them
    // or they are in the project.
    const overrides = [
      {
        name: 'com.google.firebase.messaging.default_notification_color',
        resource: '@color/notification_icon_color',
      },
      {
        name: 'com.google.firebase.messaging.default_notification_icon',
        resource: '@drawable/notification_icon',
      },
    ];

    overrides.forEach(({ name, resource }) => {
      // Find existing entry
      const existingItem = metaData.find(item => {
        const attrs = item.$ || item;
        return attrs['android:name'] === name;
      });

      if (existingItem) {
        // If exists, just add tools:replace
        const attrs = existingItem.$ || existingItem;
        attrs['tools:replace'] = 'android:resource';
        // Ensure resource value is what we expect (optional, but good for consistency)
        attrs['android:resource'] = resource;
      } else {
        // If not exists, CREATE IT with tools:replace
        // This forces our main manifest to override any library manifests
        metaData.push({
          $: {
            'android:name': name,
            'android:resource': resource,
            'tools:replace': 'android:resource',
          },
        });
      }
    });

    // Ensure xmlns:tools namespace exists on the manifest root
    const manifestAttrs = manifest.manifest.$ || manifest.manifest;
    if (!manifestAttrs['xmlns:tools']) {
      manifestAttrs['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    return config;
  });
}

module.exports = withFirebaseManifestFix;
