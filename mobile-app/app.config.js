const fs = require('fs');
const path = require('path');

const base = require('./app.json').expo;
const EAS_PROJECT_ID = base.extra?.eas?.projectId || 'dfd2f395-76a6-42c8-8219-10563be5e39d';

const CUSTOMERS_DIR = path.join(__dirname, 'customers');

function loadCustomer(customerId) {
  const id = String(customerId || '').trim().toLowerCase();
  if (!id) return null;

  const dir = path.join(CUSTOMERS_DIR, id);
  const configPath = path.join(dir, 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Unknown customer "${id}". Add customers/${id}/config.json`);
  }

  const config = require(configPath);
  return { id, dir, config };
}

function customerAsset(customer, candidates, fallback) {
  if (!customer) return fallback;
  for (const fileName of candidates) {
    const absolute = path.join(customer.dir, fileName);
    if (fs.existsSync(absolute)) {
      return `./customers/${customer.id}/${fileName}`;
    }
  }
  return fallback;
}

module.exports = () => {
  const customer = loadCustomer(process.env.CUSTOMER);

  const icon = customerAsset(customer, ['icon.png'], base.icon);
  const adaptiveIcon = customerAsset(
    customer,
    ['adaptive-icon.png', 'icon.png'],
    base.android?.adaptiveIcon?.foregroundImage
  );
  const splashIcon = customerAsset(
    customer,
    ['splash.png', 'splash-icon.png'],
    base.splash?.image
  );

  const appName = customer?.config.appName || base.name;
  // One EAS projectId → one Expo slug. Per-customer slug only when using a separate easProjectId.
  const slug =
    customer?.config.easProjectId && customer?.config.slug
      ? customer.config.slug
      : base.slug;
  const version = customer?.config.version || base.version;
  const versionCode =
    customer?.config.versionCode != null
      ? Number(customer.config.versionCode)
      : base.android?.versionCode;
  const urlScheme = customer?.config.urlScheme || base.scheme;
  const androidPackage =
    customer?.config.androidPackage || base.android?.package || 'com.elvatech.grocery';
  const iosBundleIdentifier =
    customer?.config.iosBundleIdentifier || androidPackage;
  const tenantId = customer?.config.tenantId || customer?.id || null;
  const notifyBrandId = customer?.config.notifyBrandId || null;
  const easProjectId =
    customer?.config.easProjectId || base.extra?.eas?.projectId || EAS_PROJECT_ID;

  const basePlugins = base.plugins || [];
  const plugins = [
    ...basePlugins,
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Allow $(PRODUCT_NAME) to use your location to detect your delivery address.',
      },
    ],
  ];

  return {
    expo: {
      ...base,
      name: appName,
      slug,
      version,
      icon,
      scheme: urlScheme,
      splash: {
        ...base.splash,
        image: splashIcon,
      },
      ios: {
        ...base.ios,
        bundleIdentifier: iosBundleIdentifier,
        splash: {
          ...base.ios?.splash,
          image: splashIcon,
        },
      },
      android: {
        ...base.android,
        package: androidPackage,
        ...(Number.isFinite(versionCode) && versionCode > 0 ? { versionCode } : {}),
        adaptiveIcon: {
          ...base.android?.adaptiveIcon,
          foregroundImage: adaptiveIcon,
        },
        splash: {
          ...base.android?.splash,
          image: splashIcon,
        },
      },
      web: {
        ...base.web,
        favicon: icon,
      },
      plugins: plugins.map((plugin) => {
        if (
          Array.isArray(plugin) &&
          plugin[0] === 'expo-splash-screen' &&
          plugin[1]
        ) {
          return [plugin[0], { ...plugin[1], image: splashIcon }];
        }
        return plugin;
      }),
      extra: {
        ...base.extra,
        customer: customer?.id || null,
        whitelabel: Boolean(customer),
        tenantId,
        notifyBrandId,
        urlScheme,
        eas: {
          ...(base.extra?.eas || {}),
          projectId: easProjectId,
        },
      },
    },
  };
};
