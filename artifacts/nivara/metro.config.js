const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Metro must not watch native Android/iOS directories inside node_modules.
// pnpm copies local modules to a tmp dir then deletes it; Metro racing
// to watch android/ios source there causes ENOENT crashes.
const nativeInModules = /node_modules[/\\].*[/\\](android|ios)[/\\]/;

const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  nativeInModules,
];

module.exports = config;
