module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Explicit rather than relying on babel-preset-expo's auto-detection —
    // @gorhom/bottom-sheet's animations are driven entirely by Reanimated
    // worklets, and without this transform actually running, calls like
    // BottomSheetModal.present() execute without throwing but never move
    // the sheet, since the worklets silently no-op instead of failing loud.
    // Must stay last in the plugins list per Reanimated's own requirement.
    plugins: ['react-native-worklets/plugin'],
  };
};
