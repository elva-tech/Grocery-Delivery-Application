const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const cashfreeRootPackageJson = path.join(
  __dirname,
  'node_modules',
  'react-native-cashfree-pg-sdk',
  'package.json'
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = String(context.originModulePath || '').split(path.sep).join('/');
  // The published SDK asks for lib/package.json. The real file is the package root.
  if (
    moduleName === '../package.json' &&
    origin.includes('react-native-cashfree-pg-sdk/lib/')
  ) {
    return {
      type: 'sourceFile',
      filePath: cashfreeRootPackageJson,
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
