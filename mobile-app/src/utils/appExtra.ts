import Constants from 'expo-constants';

type ExpoExtra = Record<string, unknown>;

/** Read `app.config.js` extra in dev, EAS release, and legacy manifest shapes. */
export function getAppExtra(): ExpoExtra {
  const fromExpoConfig = Constants.expoConfig?.extra;
  if (fromExpoConfig && typeof fromExpoConfig === 'object') {
    return fromExpoConfig as ExpoExtra;
  }

  const manifest2 = (
    Constants as { manifest2?: { extra?: { expoClient?: { extra?: ExpoExtra } } } }
  ).manifest2;
  const fromManifest2 = manifest2?.extra?.expoClient?.extra;
  if (fromManifest2 && typeof fromManifest2 === 'object') {
    return fromManifest2;
  }

  const legacy = (Constants as { manifest?: { extra?: ExpoExtra } }).manifest?.extra;
  if (legacy && typeof legacy === 'object') {
    return legacy;
  }

  return {};
}
