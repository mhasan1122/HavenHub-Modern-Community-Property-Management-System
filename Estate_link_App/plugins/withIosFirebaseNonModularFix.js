const { withDangerousMod } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const path = require('path');
const fs = require('fs');

const FIX_TAG = 'react-native-firebase-non-modular-includes';
const FIX_MARKER = 'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES';

/**
 * Fix iOS build error with react-native-firebase + useFrameworks static:
 * "Include of non-modular header inside framework module 'RNFBApp.*'"
 * Injects CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES in Podfile post_install.
 */
function withIosFirebaseNonModularFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents;
      try {
        contents = await fs.promises.readFile(podfilePath, 'utf-8');
      } catch (e) {
        return config;
      }

      if (contents.includes(FIX_MARKER)) {
        return config;
      }

      const snippet = `
    # Allow non-modular includes (react-native-firebase + static frameworks)
    installer.pods_project.build_configurations.each do |c|
      c.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
`;

      // Insert at start of post_install block so it runs for all pods
      const anchor = /post_install do \|installer\|/;
      let result;
      try {
        result = mergeContents({
          tag: FIX_TAG,
          src: contents,
          newSrc: snippet,
          anchor,
          offset: 1,
          comment: '#',
        });
        if (result.didMerge || result.didClear) {
          await fs.promises.writeFile(podfilePath, result.contents);
        }
      } catch (_) {
        // Fallback: raw insert after "post_install do |installer|"
        const match = contents.match(anchor);
        if (match) {
          const idx = contents.indexOf(match[0]) + match[0].length;
          const newContents = contents.slice(0, idx) + snippet + contents.slice(idx);
          await fs.promises.writeFile(podfilePath, newContents);
        }
      }

      return config;
    },
  ]);
}

module.exports = withIosFirebaseNonModularFix;
