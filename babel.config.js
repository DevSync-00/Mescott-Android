module.exports = function (api) {
  api.cache(false);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated 4 moved workletization into react-native-worklets.
      // This plugin must remain last.
      'react-native-worklets/plugin',
    ],
  };
};
