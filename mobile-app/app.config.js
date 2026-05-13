/**
 * Dynamic Expo config.
 * - No Google Maps: tiles are rendered via Ola Maps inside a WebView (see `components/AddressMapPicker.tsx`).
 *   The only key required is `EXPO_PUBLIC_OLA_MAPS_API_KEY` (set per build profile in `eas.json`).
 * - Adds `expo-location` permission strings used by the address picker’s "Use current location" flow.
 */
const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

module.exports = {
  expo: {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
    },
    plugins: [
      ...(Array.isArray(appJson.expo.plugins) ? appJson.expo.plugins : []),
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Allow Enandi to use your location to set your delivery address.',
        },
      ],
    ],
  },
};
