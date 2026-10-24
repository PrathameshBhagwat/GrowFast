const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in monorepo while preserving default watch folders
config.watchFolders = Array.from(new Set([...config.watchFolders, monorepoRoot]));

// 2. Let Metro resolve packages in mobile first, then monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Force react-native and react to resolve from mobile workspace (React Native 0.76.9 / React 18.3.1)
// preventing Metro from resolving conflicting root packages.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
};

// 4. In monorepos, disable hierarchical lookup so packages are resolved strictly
// from nodeModulesPaths in order (mobile node_modules first, then root).
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
