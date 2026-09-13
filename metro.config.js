const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Force cache reset to fix InternalBytecode.js errors
config.resetCache = true

// Disable problematic cache features
config.cacheStores = []

// Resolver configuration tuned for Windows/OneDrive paths
config.resolver = {
  ...config.resolver,
  useGlobalHotkey: false,
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
      // Worklets web-mode detection relies on eager module initialization.
      // Keep native inline requires, but disable them for the Telegram web build.
      inlineRequires: process.env.MESCOTT_TMA_BUILD !== '1',
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

