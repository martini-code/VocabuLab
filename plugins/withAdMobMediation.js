const {
  createRunOncePlugin,
  withAppBuildGradle,
  withProjectBuildGradle,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PLUGIN_NAME = 'withAdMobMediation';
const PLUGIN_MARKER = '// [VocabKeep-AdMob-Mediation]';

/**
 * Injects Maven repositories required by mediation networks (Pangle, ironSource, Mintegral, Yandex)
 */
function withMediationMavenRepos(config) {
  return withProjectBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (contents.includes(PLUGIN_MARKER)) {
      return modConfig;
    }

    const mavenBlock = `
        ${PLUGIN_MARKER}
        maven { url 'https://artifact.bytedance.com/repository/pangle' }
        maven { url 'https://android-sdk.is.com/' }
        maven { url 'https://dl-maven-android.mintegral.com/repository/mbridge_android_sdk_oversea' }
        maven { url 'https://maven.google.com' }
`;

    // Inject into allprojects.repositories
    if (contents.includes('allprojects {')) {
      contents = contents.replace(
        /allprojects\s*\{\s*repositories\s*\{/,
        (match) => `${match}${mavenBlock}`
      );
    } else {
      contents += `\nallprojects {\n    repositories {\n${mavenBlock}    }\n}\n`;
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

/**
 * Injects Android Gradle dependencies for global AdMob mediation adapters
 */
function withMediationAndroidDependencies(config) {
  return withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (contents.includes(PLUGIN_MARKER)) {
      return modConfig;
    }

    const dependenciesBlock = `
    ${PLUGIN_MARKER}
    // Global Google AdMob Mediation Adapters
    implementation 'com.google.ads.mediation:facebook:6.18.0.0'
    implementation 'com.google.ads.mediation:applovin:13.1.0.0'
    implementation 'com.google.ads.mediation:unity:4.13.1.0'
    implementation 'com.google.ads.mediation:mintegral:16.9.41.0'
    implementation 'com.google.ads.mediation:ironsource:8.7.0.0'
    implementation 'com.google.ads.mediation:inmobi:10.8.0.0'
    implementation 'com.google.ads.mediation:pangle:6.4.0.6.0'
    implementation 'com.google.ads.mediation:vungle:7.4.3.0'
    implementation 'com.google.ads.mediation:fyber:8.3.5.0'
    implementation 'com.yandex.ads.adapter:admob-mobileads:7.7.0.0'
`;

    if (contents.includes('dependencies {')) {
      contents = contents.replace(
        'dependencies {',
        `dependencies {${dependenciesBlock}`
      );
    } else {
      contents += `\ndependencies {\n${dependenciesBlock}\n}\n`;
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

/**
 * Injects iOS CocoaPods dependencies into Podfile for AdMob mediation adapters
 */
function withMediationIOSPods(config) {
  return withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        return modConfig;
      }

      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');
      if (podfileContent.includes(PLUGIN_MARKER)) {
        return modConfig;
      }

      const podsBlock = `
  ${PLUGIN_MARKER}
  # Global Google AdMob Mediation Adapters
  pod 'GoogleMobileAdsMediationFacebook'
  pod 'GoogleMobileAdsMediationAppLovin'
  pod 'GoogleMobileAdsMediationUnity'
  pod 'GoogleMobileAdsMediationMintegral'
  pod 'GoogleMobileAdsMediationIronSource'
  pod 'GoogleMobileAdsMediationInMobi'
  pod 'GoogleMobileAdsMediationPangle'
  pod 'GoogleMobileAdsMediationVungle'
  pod 'GoogleMobileAdsMediationFyber'
  pod 'YandexMobileAdsMediation'
`;

      // Insert inside the main target block before the closing end or post_install
      if (podfileContent.includes('use_expo_modules!')) {
        podfileContent = podfileContent.replace(
          'use_expo_modules!',
          `use_expo_modules!\n${podsBlock}`
        );
      } else {
        podfileContent += `\n${podsBlock}\n`;
      }

      fs.writeFileSync(podfilePath, podfileContent, 'utf-8');
      return modConfig;
    },
  ]);
}

const withAdMobMediation = (config) => {
  config = withMediationMavenRepos(config);
  config = withMediationAndroidDependencies(config);
  config = withMediationIOSPods(config);
  return config;
};

module.exports = createRunOncePlugin(withAdMobMediation, PLUGIN_NAME, '1.0.0');
