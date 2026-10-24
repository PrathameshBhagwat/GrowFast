module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // In npm workspaces, babel-preset-expo is hoisted to the monorepo root while
      // expo-router is installed in apps/mobile/node_modules.
      // babel-preset-expo's internal hasModule('expo-router') check uses require.resolve
      // from the root context, which cannot find expo-router in apps/mobile.
      // Explicitly include expo-router's babel plugin to transform process.env.EXPO_ROUTER_APP_ROOT.
      require('babel-preset-expo/build/expo-router-plugin').expoRouterBabelPlugin,
    ],
  };
};
