const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Force cache reset to fix InternalBytecode.js errors
config.resetCache = true

// Disable problematic cache features
config.cacheStores = []

// Resolver configuration tuned for Windows/OneDrive paths
config.resolver = {
  ...config.resolver,
  platforms: ['ios', 'android', 'native', 'web'],
  useGlobalHotkey: false,
  sourceExts: [...(config.resolver?.sourceExts || []), 'tsx', 'ts', 'jsx', 'js'],
}

// Transformer configuration
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  },
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
}

// Serializer configuration
config.serializer = {
  ...config.serializer,
  createModuleIdFactory: () => (filePath) => {
    const normalizedPath = filePath.replace(/\\/g, '/')
    const crypto = require('crypto')
    return crypto.createHash('md5').update(normalizedPath).digest('hex').substring(0, 8)
  },
}

module.exports = config

