import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  initVault,
  getVaultStats,
  getLanguagePairSettings,
  getDeckTitleLanguagePreference,
  setDeckTitleLanguagePreference,
  DeckTitleLanguageMode,
} from './src/db/vault';
import { syncDatabaseFromR2, ensureDefaultLanguagePairInstalled } from './src/db/downloader';
import { VaultStats, LanguagePairSettings } from './src/types';
import { ReviewSession } from './src/features/pipeline/ReviewSession';
import { DecksRoadmap } from './src/features/decks/DecksRoadmap';
import { ProgressScreen } from './src/features/progress/ProgressScreen';
import { LexMascot } from './src/components/mascot/Mascots';
import './src/locales';
import { useTranslation } from 'react-i18next';
import { getDeviceLanguage, changeAppLanguage } from './src/locales';
import { getLanguageFlag, formatLanguageCode } from './src/locales/languages';
import { LanguageSelectorModal } from './src/components/modals/LanguageSelectorModal';
import { AdFreeModal } from './src/components/modals/AdFreeModal';
import { TokenWalletModal } from './src/components/tokens/TokenWalletModal';
import { MockProfileModal } from './src/components/dev/MockProfileModal';
import { TokenPill } from './src/components/tokens/TokenPill';
import { InsufficientTokensModal } from './src/components/tokens/InsufficientTokensModal';
import { RewardedAdModal } from './src/components/ads/RewardedAdModal';
import { tokenWallet } from './src/services/tokenWallet';
import { adMobService } from './src/services/adMobService';
import { iapService } from './src/services/iapService';
import { srsManager } from './src/srs';
import { configureAudioSession } from './src/utils/tts';
import {
  FlaskConical,
  Library,
  Activity,
  Coins,
  Flame,
  TestTube,
  ShieldCheck,
  Globe,
  Sparkles,
  Zap,
  Check,
  Languages,
} from 'lucide-react-native';

import { colors } from './src/theme';

type TabType = 'pipeline' | 'archives' | 'chronicles' | 'treasury';

export default function App() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('pipeline');
  const [isVaultReady, setIsVaultReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Powering up the lab...');
  const [languageModalMode, setLanguageModalMode] = useState<'origin' | 'destination'>('destination');
  const [languagePair, setLanguagePair] = useState<LanguagePairSettings>(() => {
    const dev = getDeviceLanguage();
    return {
      origin_lang: dev,
      destination_lang: dev === 'en' ? 'es' : 'en',
    };
  });
  const [stats, setStats] = useState<VaultStats>({
    totalCards: 0,
    dueCards: 0,
    newCards: 0,
    masteredCards: 0,
    streakDays: 4,
  });
  const [deckFilter, setDeckFilter] = useState<{ id: string; name: string } | null>(null);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [adFreeModalOpen, setAdFreeModalOpen] = useState(false);
  const [isAdFree, setIsAdFree] = useState(false);
  const [activeAlgoName, setActiveAlgoName] = useState(srsManager.getActiveAlgorithm().meta.name);
  const [tokenWalletModalOpen, setTokenWalletModalOpen] = useState(false);
  const [insufficientModalOpen, setInsufficientModalOpen] = useState(false);
  const [insufficientRequiredWords, setInsufficientRequiredWords] = useState(1);
  const [rewardedAdModalOpen, setRewardedAdModalOpen] = useState(false);
  const [rewardedAdOnComplete, setRewardedAdOnComplete] = useState<(() => void) | null>(null);
  const [rewardedAdOnClose, setRewardedAdOnClose] = useState<(() => void) | null>(null);
  const [mockProfileModalOpen, setMockProfileModalOpen] = useState(false);
  const [deckTitleLanguage, setDeckTitleLanguage] = useState<DeckTitleLanguageMode>('origin');
  const [isReviewInProgress, setIsReviewInProgress] = useState(false);

  useEffect(() => {
    bootstrapApp();
    iapService.init((status) => {
      setIsAdFree(status);
    });

    const unsubSRS = srsManager.subscribe(() => {
      setActiveAlgoName(srsManager.getActiveAlgorithm().meta.name);
    });

    tokenWallet.initTokenWallet();

    adMobService.setFallbackModalHandler((_show, onRewarded, onClose) => {
      // Avoid dual-modal presentation collision on iOS Fabric
      setTokenWalletModalOpen(false);
      setInsufficientModalOpen(false);
      setRewardedAdOnComplete(() => onRewarded);
      setRewardedAdOnClose(() => onClose);
      setRewardedAdModalOpen(true);
    });

    return () => {
      iapService.disconnect();
      unsubSRS();
    };
  }, []);

  const bootstrapApp = async () => {
    try {
      // Preload AdMob rewarded ads in background immediately
      adMobService.preload();
      configureAudioSession().catch(() => {});
      setStatusMessage('Checking lab cards...');
      await syncDatabaseFromR2();

      setStatusMessage('Preparing SQLite vault with WAL mode & FTS5...');
      await initVault();
      await srsManager.init();
      setActiveAlgoName(srsManager.getActiveAlgorithm().meta.name);

      setStatusMessage('Detecting lab language & cards...');
      const deviceLang = getDeviceLanguage();
      await ensureDefaultLanguagePairInstalled(deviceLang);
      const currentPair = await getLanguagePairSettings();
      setLanguagePair(currentPair);
      await changeAppLanguage(currentPair.origin_lang);

      const titlePref = await getDeckTitleLanguagePreference();
      setDeckTitleLanguage(titlePref);

      const currentStats = await getVaultStats(currentPair.destination_lang);
      setStats(currentStats);

      setIsVaultReady(true);
    } catch (error) {
      console.error('[VocabuLab] Bootstrap error:', error);
      setIsVaultReady(true);
    }
  };

  const refreshStats = async (destLang?: string) => {
    try {
      const currentStats = await getVaultStats(destLang || languagePair.destination_lang);
      setStats(currentStats);
    } catch (error) {
      // Ignore
    }
  };

  const handleInsufficientTokens = (requiredWords: number) => {
    setInsufficientRequiredWords(requiredWords);
    setInsufficientModalOpen(true);
  };

  if (!isVaultReady) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.splashContainer}>
          <LexMascot mood="idle" size={130} />
          <Text style={styles.splashTitle}>VOCABULAB</Text>
          <Text style={styles.splashTagline}>The Language Lab of Spaced Memory</Text>
          <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: 24 }} />
          <Text style={styles.splashStatus}>{statusMessage}</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.primary[50]} />

      {/* Top Lab Stats Header (Vector Icons - Strictly No Emojis) */}
      {!isReviewInProgress && (
        <View style={styles.topStatsBar}>
          {/* Streak Flame */}
          <View style={styles.statPill}>
            <Flame size={16} color={colors.danger[600]} />
            <Text style={styles.statValue}>{stats.streakDays}</Text>
          </View>

          {/* Due Cards Test Tube */}
          <View style={styles.statPill}>
            <TestTube size={16} color={colors.success[600]} />
            <Text style={styles.statValue}>{stats.dueCards} {t('stats.due')}</Text>
          </View>

          {/* Token Allowance Pill (Isolated component, granularly subscribed to wallet updates) */}
          <TokenPill onPress={() => setTokenWalletModalOpen(true)} />

          {/* Destination Language Selector Pill (Displays flag and uppercase language code, without language name) */}
          <TouchableOpacity
            style={styles.statPill}
            testID="top-language-pill"
            onPress={() => {
              setLanguageModalMode('destination');
              setLanguageModalOpen(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.flagEmoji}>
              {getLanguageFlag(languagePair.destination_lang)}
            </Text>
            <Text style={styles.statValue}>
              {formatLanguageCode(languagePair.destination_lang)}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main View Area */}
      <View style={styles.contentArea}>
        {activeTab === 'pipeline' && (
          <ReviewSession
            onSessionComplete={() => {
              setIsReviewInProgress(false);
              refreshStats();
            }}
            onExploreArchives={() => {
              setIsReviewInProgress(false);
              setActiveTab('archives');
            }}
            deckFilter={deckFilter}
            onClearDeckFilter={() => setDeckFilter(null)}
            targetLang={languagePair.destination_lang}
            originLang={languagePair.origin_lang}
            onInsufficientTokens={handleInsufficientTokens}
            onReviewActiveChange={setIsReviewInProgress}
          />
        )}
        {activeTab === 'archives' && (
          <DecksRoadmap
            onStudyDeck={(deckId, deckName) => {
              setDeckFilter({ id: deckId, name: deckName });
              refreshStats();
              setIsReviewInProgress(false);
              setActiveTab('pipeline');
            }}
            onStartReview={() => {
              setDeckFilter(null);
              refreshStats();
              setIsReviewInProgress(false);
              setActiveTab('pipeline');
            }}
            targetLang={languagePair.destination_lang}
            originLang={languagePair.origin_lang}
            deckTitleLanguage={deckTitleLanguage}
            onInsufficientTokens={handleInsufficientTokens}
          />
        )}
        {activeTab === 'chronicles' && <ProgressScreen />}
        {activeTab === 'treasury' && (
          <ScrollView
            style={styles.treasuryScrollView}
            contentContainerStyle={styles.treasuryTabContainer}
            showsVerticalScrollIndicator={false}
          >
            <LexMascot mood="victorious" size={120} />
            <Text style={styles.treasuryTitle}>{t('treasury.title', { defaultValue: 'THE LAB CONSOLE' })}</Text>
            <Text style={styles.treasurySub}>{t('treasury.subtitle', { defaultValue: 'Zero Cloud Overhead • 100% Local Lab' })}</Text>

            <View style={styles.statsCard}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{t('treasury.total_cards', { defaultValue: 'Total Learned Cards:' })}</Text>
                <Text style={styles.statNumber}>{stats.totalCards}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Pending Reviews (Due):</Text>
                <Text style={styles.statNumber}>{stats.dueCards}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Mastered Cards (S≥10):</Text>
                <Text style={styles.statNumber}>{stats.masteredCards}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Database Engine:</Text>
                <Text style={styles.statHighlight}>SQLite WAL + FTS5</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Spaced Repetition Algorithm:</Text>
                <Text style={styles.statHighlight}>{srsManager.getActiveAlgorithm().meta.shortName}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Cloud Infrastructure Cost:</Text>
                <Text style={styles.statFree}>$0.00 / mo</Text>
              </View>
            </View>

            {/* SRS Engine Card in Lab Console (FSRS v5 Exclusively) */}
            <View style={styles.treasuryAlgoBtn}>
              <Zap size={20} color={colors.primary[700]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.treasuryAlgoTitle}>
                  SRS ENGINE: FSRS v5
                </Text>
                <Text style={styles.treasuryAlgoSub} numberOfLines={1}>
                  State-of-the-Art Machine Learning (Highest Efficiency)
                </Text>
              </View>
              <View style={styles.treasuryAlgoActiveBadge}>
                <Check size={12} color={colors.success[800]} />
                <Text style={styles.treasuryAlgoActiveText}>ACTIVE</Text>
              </View>
            </View>

            {/* Ad-Free Status in Lab Console */}
            {isAdFree ? (
              <View style={styles.treasuryAdFreeCard}>
                <ShieldCheck size={22} color={colors.success[700]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.treasuryAdFreeTitle}>
                    {t('ad_free.purchased_badge')}
                  </Text>
                  <Text style={styles.treasuryAdFreeSub}>
                    {t('ad_free.benefit_1_sub')}
                  </Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.treasuryUpgradeBtn}
                onPress={() => setAdFreeModalOpen(true)}
                activeOpacity={0.85}
              >
                <Sparkles size={18} color={colors.neutral[0]} />
                <Text style={styles.treasuryUpgradeText}>
                  {t('ad_free.modal_title')} • {t('ad_free.go_ad_free')}
                </Text>
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.treasuryActionBtn, { flex: 1, marginTop: 0, backgroundColor: colors.primary[50], borderColor: colors.primary[300] }]}
                onPress={() => {
                  setLanguageModalMode('origin');
                  setLanguageModalOpen(true);
                }}
              >
                <Text style={[styles.treasuryActionText, { color: colors.primary[800] }]}>
                  App Origin: {formatLanguageCode(languagePair.origin_lang)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.treasuryActionBtn, { flex: 1, marginTop: 0 }]}
                onPress={() => {
                  setLanguageModalMode('destination');
                  setLanguageModalOpen(true);
                }}
              >
                <Text style={styles.treasuryActionText}>
                  Study Target: {formatLanguageCode(languagePair.destination_lang)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Deck & Subdeck Title Language Preference Setting */}
            <View style={styles.deckTitlePrefCard}>
              <View style={styles.deckTitlePrefHeader}>
                <Languages size={18} color={colors.primary[800]} />
                <Text style={styles.deckTitlePrefTitle}>Deck & Topic Titles</Text>
              </View>
              <Text style={styles.deckTitlePrefSubtitle}>
                Choose the display language for categories, decks, and subdecks.
              </Text>
              <View style={styles.deckTitleToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.deckTitleToggleBtn,
                    deckTitleLanguage === 'origin' && styles.deckTitleToggleBtnActive,
                  ]}
                  onPress={async () => {
                    await setDeckTitleLanguagePreference('origin');
                    setDeckTitleLanguage('origin');
                  }}
                  activeOpacity={0.8}
                >
                  {deckTitleLanguage === 'origin' && <Check size={14} color={colors.primary[700]} />}
                  <Text
                    style={[
                      styles.deckTitleToggleText,
                      deckTitleLanguage === 'origin' && styles.deckTitleToggleTextActive,
                    ]}
                  >
                    Native ({formatLanguageCode(languagePair.origin_lang)})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.deckTitleToggleBtn,
                    deckTitleLanguage === 'target' && styles.deckTitleToggleBtnActive,
                  ]}
                  onPress={async () => {
                    await setDeckTitleLanguagePreference('target');
                    setDeckTitleLanguage('target');
                  }}
                  activeOpacity={0.8}
                >
                  {deckTitleLanguage === 'target' && <Check size={14} color={colors.primary[700]} />}
                  <Text
                    style={[
                      styles.deckTitleToggleText,
                      deckTitleLanguage === 'target' && styles.deckTitleToggleTextActive,
                    ]}
                  >
                    Immersion ({formatLanguageCode(languagePair.destination_lang)})
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.deckTitlePrefNote}>
                {deckTitleLanguage === 'origin'
                  ? '✓ Recommended: Beginner friendly, titles shown in your native language.'
                  : '⚡ Advanced: Full immersion, titles shown in the language you are learning.'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.treasuryActionBtn, { marginTop: 12, backgroundColor: colors.neutral[50], borderColor: colors.neutral[300] }]}
              onPress={() => setMockProfileModalOpen(true)}
            >
              <Text style={[styles.treasuryActionText, { color: colors.neutral[700] }]}>
                SWITCH TESTING PROFILE
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* Lab Cartoon Bottom Tab Bar */}
      {!isReviewInProgress && (
        <View style={styles.bottomNav}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              refreshStats();
              setActiveTab('pipeline');
            }}
            style={[styles.navItem, activeTab === 'pipeline' && styles.navItemActive]}
          >
            <FlaskConical size={20} color={activeTab === 'pipeline' ? colors.primary[700] : colors.neutral[500]} />
            <Text style={[styles.navLabel, activeTab === 'pipeline' && styles.navLabelActive]}>
              {t('nav.training')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              refreshStats();
              setActiveTab('archives');
            }}
            style={[styles.navItem, activeTab === 'archives' && styles.navItemActive]}
          >
            <Library size={20} color={activeTab === 'archives' ? colors.primary[700] : colors.neutral[500]} />
            <Text style={[styles.navLabel, activeTab === 'archives' && styles.navLabelActive]}>
              {t('nav.decks')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              refreshStats();
              setActiveTab('chronicles');
            }}
            style={[styles.navItem, activeTab === 'chronicles' && styles.navItemActive]}
          >
            <Activity size={20} color={activeTab === 'chronicles' ? colors.primary[700] : colors.neutral[500]} />
            <Text style={[styles.navLabel, activeTab === 'chronicles' && styles.navLabelActive]}>
              {t('nav.chronicles')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              refreshStats();
              setActiveTab('treasury');
            }}
            style={[styles.navItem, activeTab === 'treasury' && styles.navItemActive]}
          >
            <Coins size={20} color={activeTab === 'treasury' ? colors.primary[700] : colors.neutral[500]} />
            <Text style={[styles.navLabel, activeTab === 'treasury' && styles.navLabelActive]}>
              {t('nav.treasury')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Language Selector Modal (123 Languages & Offline Packs) */}
      <LanguageSelectorModal
        visible={languageModalOpen}
        onClose={() => setLanguageModalOpen(false)}
        initialMode={languageModalMode}
        onPairChanged={async (newPair) => {
          setLanguagePair(newPair);
          setDeckFilter(null);
          await refreshStats(newPair.destination_lang);
        }}
      />

      {/* Ad-Free Upgrade Modal (In-App Purchases) */}
      <AdFreeModal
        visible={adFreeModalOpen}
        onClose={() => setAdFreeModalOpen(false)}
        isAdFree={isAdFree}
        onStatusChanged={(status) => setIsAdFree(status)}
      />


      {/* Lab Token Wallet Modal */}
      <TokenWalletModal
        visible={tokenWalletModalOpen}
        onClose={() => setTokenWalletModalOpen(false)}
        onOpenPlusModal={() => setAdFreeModalOpen(true)}
      />

      {/* Insufficient Tokens Warning / Ad CTA Modal */}
      <InsufficientTokensModal
        visible={insufficientModalOpen}
        onClose={() => setInsufficientModalOpen(false)}
        onOpenPlusModal={() => setAdFreeModalOpen(true)}
        requiredWords={insufficientRequiredWords}
        onSuccessLearn={() => {
          refreshStats();
        }}
      />

      {/* Rewarded Ad Modal (Fallback & Dev/Web Simulation) */}
      <RewardedAdModal
        visible={rewardedAdModalOpen}
        onClose={() => {
          setRewardedAdModalOpen(false);
          if (rewardedAdOnClose) {
            rewardedAdOnClose();
            setRewardedAdOnClose(null);
          }
        }}
        onReward={() => {
          if (rewardedAdOnComplete) {
            rewardedAdOnComplete();
            setRewardedAdOnComplete(null);
          }
        }}
      />

      {/* Testing Profiles Switcher Modal */}
      <MockProfileModal
        visible={mockProfileModalOpen}
        onClose={() => setMockProfileModalOpen(false)}
        targetLang={languagePair.destination_lang}
        originLang={languagePair.origin_lang}
        onProfileApplied={async () => {
          await refreshStats();
        }}
      />
    </SafeAreaView>
  </SafeAreaProvider>
);
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary[50],
  },
  splashContainer: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary[900],
    marginTop: 18,
    letterSpacing: 1,
  },
  splashTagline: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary[700],
    marginTop: 4,
  },
  splashStatus: {
    fontSize: 13,
    color: colors.neutral[400],
    marginTop: 14,
    fontWeight: '600',
  },
  topStatsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 2,
    borderBottomColor: colors.neutral[200],
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
  },
  flagEmoji: {
    fontSize: 15,
    marginRight: 4,
  },
  tokenPill: {
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[100],
    gap: 4,
  },
  tokenPillText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary[700],
  },
  proPill: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[100],
  },
  proPillActive: {
    borderColor: colors.success[500],
    backgroundColor: colors.success[100],
  },
  statEmoji: {
    fontSize: 14,
    marginRight: 5,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.neutral[800],
  },
  proText: {
    color: colors.primary[700],
  },
  proTextActive: {
    color: colors.success[700],
  },
  contentArea: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[0],
    borderTopWidth: 2,
    borderColor: colors.neutral[200],
    paddingBottom: 8,
    paddingTop: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  navItemActive: {
    borderTopWidth: 3,
    borderTopColor: colors.primary[500],
    marginTop: -3,
  },
  navEmoji: {
    fontSize: 22,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.neutral[500],
    marginTop: 2,
  },
  navLabelActive: {
    color: colors.primary[700],
  },
  treasuryScrollView: {
    flex: 1,
    width: '100%',
  },
  treasuryTabContainer: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
  treasuryTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.neutral[800],
    marginTop: 12,
    letterSpacing: 0.5,
  },
  treasurySub: {
    fontSize: 13,
    color: colors.neutral[500],
    fontWeight: '600',
    marginTop: 4,
  },
  statsCard: {
    width: '100%',
    backgroundColor: colors.neutral[0],
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.neutral[200],
    borderBottomWidth: 4,
    borderBottomColor: colors.neutral[300],
    padding: 16,
    marginTop: 20,
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  statNumber: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.neutral[800],
  },
  statHighlight: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary[700],
  },
  statFree: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.success[500],
  },
  treasuryActionBtn: {
    backgroundColor: colors.primary[100],
    borderWidth: 2,
    borderColor: colors.primary[500],
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 24,
    width: '100%',
    alignItems: 'center',
  },
  treasuryActionText: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.primary[700],
    letterSpacing: 0.5,
  },
  adFreePillFree: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  adFreePillActive: {
    borderColor: colors.success[500],
    backgroundColor: colors.success[50],
  },
  adFreeTextFree: {
    color: colors.primary[700],
  },
  adFreeTextActive: {
    color: colors.success[700],
  },
  treasuryAdFreeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success[50],
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.success[200],
    padding: 14,
    marginTop: 18,
    width: '100%',
    gap: 12,
  },
  treasuryAdFreeTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.success[700],
    letterSpacing: 0.5,
  },
  treasuryAdFreeSub: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success[800],
    marginTop: 2,
  },
  treasuryUpgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 18,
    width: '100%',
    gap: 8,
    borderBottomWidth: 3,
    borderBottomColor: colors.primary[700],
  },
  treasuryUpgradeText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.neutral[0],
    letterSpacing: 0.5,
  },
  treasuryAlgoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[100],
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    padding: 14,
    marginTop: 14,
    width: '100%',
    gap: 12,
  },
  treasuryAlgoTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary[900],
    letterSpacing: 0.5,
  },
  treasuryAlgoSub: {
    fontSize: 11,
    color: colors.primary[800],
    marginTop: 2,
  },
  treasuryAlgoActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  treasuryAlgoActiveText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.success[800],
    letterSpacing: 0.5,
  },
  deckTitlePrefCard: {
    backgroundColor: colors.primary[100],
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    padding: 14,
    marginTop: 12,
    width: '100%',
  },
  deckTitlePrefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  deckTitlePrefTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary[900],
    letterSpacing: 0.5,
  },
  deckTitlePrefSubtitle: {
    fontSize: 11,
    color: colors.primary[800],
    marginBottom: 10,
    lineHeight: 15,
  },
  deckTitleToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  deckTitleToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary[50],
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  deckTitleToggleBtnActive: {
    backgroundColor: colors.neutral[0],
    borderColor: colors.primary[700],
    shadowColor: colors.primary[700],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  deckTitleToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary[800],
    letterSpacing: 0.3,
  },
  deckTitleToggleTextActive: {
    color: colors.primary[700],
    fontWeight: '900',
  },
  deckTitlePrefNote: {
    fontSize: 10,
    color: colors.primary[700],
    marginTop: 8,
    fontStyle: 'italic',
  },
});
