import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { initVault, getVaultStats, getLanguagePairSettings } from './src/db/vault';
import { syncDatabaseFromR2, ensureDefaultLanguagePairInstalled } from './src/db/downloader';
import { VaultStats, LanguagePairSettings } from './src/types';
import { ReviewSession } from './src/features/pipeline/ReviewSession';
import { DecksRoadmap } from './src/features/decks/DecksRoadmap';
import { FastSearch } from './src/features/search/FastSearch';
import { ProgressScreen } from './src/features/progress/ProgressScreen';
import { SquireMascot } from './src/components/mascot/Mascots';
import './src/locales';
import { useTranslation } from 'react-i18next';
import { getDeviceLanguage, changeAppLanguage } from './src/locales';
import { LanguageSelectorModal } from './src/components/modals/LanguageSelectorModal';
import { AdFreeModal } from './src/components/modals/AdFreeModal';
import { TokenWalletModal } from './src/components/tokens/TokenWalletModal';
import { TokenPill } from './src/components/tokens/TokenPill';
import { InsufficientTokensModal } from './src/components/tokens/InsufficientTokensModal';
import { RewardedAdModal } from './src/components/ads/RewardedAdModal';
import { tokenWallet } from './src/services/tokenWallet';
import { adMobService } from './src/services/adMobService';
import { iapService } from './src/services/iapService';
import { srsManager } from './src/srs';
import {
  Swords,
  Library,
  Search as SearchIcon,
  Activity,
  Coins,
  Flame,
  Shield,
  ShieldCheck,
  Globe,
  Sparkles,
  Zap,
  Check,
} from 'lucide-react-native';

type TabType = 'pipeline' | 'archives' | 'search' | 'chronicles' | 'treasury';

export default function App() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('pipeline');
  const [isVaultReady, setIsVaultReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Opening the fortress gates...');
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

  useEffect(() => {
    bootstrapKeep();
    iapService.init((status) => {
      setIsAdFree(status);
    });

    const unsubSRS = srsManager.subscribe(() => {
      setActiveAlgoName(srsManager.getActiveAlgorithm().meta.name);
    });

    tokenWallet.initTokenWallet();

    adMobService.setFallbackModalHandler((onComplete) => {
      setRewardedAdOnComplete(() => onComplete);
      setRewardedAdModalOpen(true);
    });

    return () => {
      iapService.disconnect();
      unsubSRS();
    };
  }, []);

  const bootstrapKeep = async () => {
    try {
      // Preload AdMob rewarded ads in background immediately
      adMobService.preload();
      setStatusMessage('Checking kingdom scrolls...');
      await syncDatabaseFromR2();

      setStatusMessage('Inscribing SQLite vault with WAL mode & FTS5...');
      await initVault();
      await srsManager.init();
      setActiveAlgoName(srsManager.getActiveAlgorithm().meta.name);

      setStatusMessage('Detecting kingdom language & scrolls...');
      const deviceLang = getDeviceLanguage();
      await ensureDefaultLanguagePairInstalled(deviceLang);
      const currentPair = await getLanguagePairSettings();
      setLanguagePair(currentPair);
      await changeAppLanguage(currentPair.origin_lang);

      const currentStats = await getVaultStats(currentPair.destination_lang);
      setStats(currentStats);

      setIsVaultReady(true);
    } catch (error) {
      console.error('[VocabKeep] Bootstrap error:', error);
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
          <SquireMascot mood="idle" size={130} />
          <Text style={styles.splashTitle}>VOCAB KEEP</Text>
          <Text style={styles.splashTagline}>The Medieval Fortress of Spaced Memory</Text>
          <ActivityIndicator size="large" color="#F59E0B" style={{ marginTop: 24 }} />
          <Text style={styles.splashStatus}>{statusMessage}</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FEFCE8" />

      {/* Top Medieval Stats Header (Vector Icons - Strictly No Emojis) */}
      <View style={styles.topStatsBar}>
        {/* Streak Flame */}
        <View style={styles.statPill}>
          <Flame size={16} color="#DC2626" />
          <Text style={styles.statValue}>{stats.streakDays}</Text>
        </View>

        {/* Due Cards Shield */}
        <View style={styles.statPill}>
          <Shield size={16} color="#0D9488" />
          <Text style={styles.statValue}>{stats.dueCards} {t('stats.due')}</Text>
        </View>

        {/* Token Allowance Pill (Isolated component, granularly subscribed to wallet updates) */}
        <TokenPill onPress={() => setTokenWalletModalOpen(true)} />

        {/* Destination Language Selector Pill (Only displays learning language) */}
        <TouchableOpacity
          style={styles.statPill}
          onPress={() => {
            setLanguageModalMode('destination');
            setLanguageModalOpen(true);
          }}
          activeOpacity={0.8}
        >
          <Globe size={16} color="#78350F" />
          <Text style={styles.statValue}>
            {languagePair.destination_lang.toUpperCase()}
          </Text>
        </TouchableOpacity>

        {/* Ad-Free Status / Upgrade Pill */}
        <TouchableOpacity
          style={[styles.statPill, isAdFree ? styles.adFreePillActive : styles.adFreePillFree]}
          onPress={() => setAdFreeModalOpen(true)}
          activeOpacity={0.8}
        >
          {isAdFree ? (
            <ShieldCheck size={16} color="#047857" />
          ) : (
            <Sparkles size={16} color="#B45309" />
          )}
          <Text style={[styles.statValue, isAdFree ? styles.adFreeTextActive : styles.adFreeTextFree]}>
            {isAdFree ? t('ad_free.status_active') : t('ad_free.go_ad_free')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main View Area */}
      <View style={styles.contentArea}>
        {activeTab === 'pipeline' && (
          <ReviewSession
            onSessionComplete={() => {
              refreshStats();
            }}
            onExploreArchives={() => setActiveTab('archives')}
            deckFilter={deckFilter}
            onClearDeckFilter={() => setDeckFilter(null)}
            targetLang={languagePair.destination_lang}
            originLang={languagePair.origin_lang}
          />
        )}
        {activeTab === 'archives' && (
          <DecksRoadmap
            onStudyDeck={(deckId, deckName) => {
              setDeckFilter({ id: deckId, name: deckName });
              refreshStats();
              setActiveTab('pipeline');
            }}
            onStartReview={() => {
              setDeckFilter(null);
              refreshStats();
              setActiveTab('pipeline');
            }}
            targetLang={languagePair.destination_lang}
            originLang={languagePair.origin_lang}
            onInsufficientTokens={handleInsufficientTokens}
          />
        )}
        {activeTab === 'search' && (
          <FastSearch onInsufficientTokens={handleInsufficientTokens} />
        )}
        {activeTab === 'chronicles' && <ProgressScreen />}
        {activeTab === 'treasury' && (
          <View style={styles.treasuryTabContainer}>
            <SquireMascot mood="victorious" size={120} />
            <Text style={styles.treasuryTitle}>THE ROYAL TREASURY</Text>
            <Text style={styles.treasurySub}>Zero Cloud Overhead • 100% Local Fortress</Text>

            <View style={styles.statsCard}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Garrisoned Cards:</Text>
                <Text style={styles.statNumber}>{stats.totalCards}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Pending Reviews (Due):</Text>
                <Text style={styles.statNumber}>{stats.dueCards}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Mastered Scrolls (S≥10):</Text>
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

            {/* SRS Engine Card in Treasury (FSRS v5 Exclusively) */}
            <View style={styles.treasuryAlgoBtn}>
              <Zap size={20} color="#B45309" />
              <View style={{ flex: 1 }}>
                <Text style={styles.treasuryAlgoTitle}>
                  SRS ENGINE: FSRS v5
                </Text>
                <Text style={styles.treasuryAlgoSub} numberOfLines={1}>
                  State-of-the-Art Machine Learning (Highest Efficiency)
                </Text>
              </View>
              <View style={styles.treasuryAlgoActiveBadge}>
                <Check size={12} color="#065F46" />
                <Text style={styles.treasuryAlgoActiveText}>ACTIVE</Text>
              </View>
            </View>

            {/* Ad-Free Status in Treasury */}
            {isAdFree ? (
              <View style={styles.treasuryAdFreeCard}>
                <ShieldCheck size={22} color="#047857" />
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
                <Sparkles size={18} color="#FFFFFF" />
                <Text style={styles.treasuryUpgradeText}>
                  {t('ad_free.modal_title')} • {t('ad_free.go_ad_free')}
                </Text>
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.treasuryActionBtn, { flex: 1, marginTop: 0, backgroundColor: '#EFF6FF', borderColor: '#93C5FD' }]}
                onPress={() => {
                  setLanguageModalMode('origin');
                  setLanguageModalOpen(true);
                }}
              >
                <Text style={[styles.treasuryActionText, { color: '#1D4ED8' }]}>
                  APP ORIGIN: {languagePair.origin_lang.toUpperCase()}
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
                  STUDY TARGET: {languagePair.destination_lang.toUpperCase()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Medieval Cartoon Bottom Tab Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            refreshStats();
            setActiveTab('pipeline');
          }}
          style={[styles.navItem, activeTab === 'pipeline' && styles.navItemActive]}
        >
          <Swords size={20} color={activeTab === 'pipeline' ? '#B45309' : '#64748B'} />
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
          <Library size={20} color={activeTab === 'archives' ? '#B45309' : '#64748B'} />
          <Text style={[styles.navLabel, activeTab === 'archives' && styles.navLabelActive]}>
            {t('nav.decks')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            refreshStats();
            setActiveTab('search');
          }}
          style={[styles.navItem, activeTab === 'search' && styles.navItemActive]}
        >
          <SearchIcon size={20} color={activeTab === 'search' ? '#B45309' : '#64748B'} />
          <Text style={[styles.navLabel, activeTab === 'search' && styles.navLabelActive]}>
            {t('nav.search')}
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
          <Activity size={20} color={activeTab === 'chronicles' ? '#B45309' : '#64748B'} />
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
          <Coins size={20} color={activeTab === 'treasury' ? '#B45309' : '#64748B'} />
          <Text style={[styles.navLabel, activeTab === 'treasury' && styles.navLabelActive]}>
            {t('nav.treasury')}
          </Text>
        </TouchableOpacity>
      </View>

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


      {/* Royal Token Wallet Modal */}
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
        onClose={() => setRewardedAdModalOpen(false)}
        onReward={() => {
          if (rewardedAdOnComplete) {
            rewardedAdOnComplete();
            setRewardedAdOnComplete(null);
          }
        }}
      />
    </SafeAreaView>
  </SafeAreaProvider>
);
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FEFCE8',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFFDF7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#78350F',
    marginTop: 18,
    letterSpacing: 1,
  },
  splashTagline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B45309',
    marginTop: 4,
  },
  splashStatus: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 14,
    fontWeight: '600',
  },
  topStatsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  tokenPill: {
    borderColor: '#FDE68A',
    backgroundColor: '#FEF3C7',
    gap: 4,
  },
  tokenPillText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#B45309',
  },
  proPill: {
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  proPillActive: {
    borderColor: '#10B981',
    backgroundColor: '#D1FAE5',
  },
  statEmoji: {
    fontSize: 14,
    marginRight: 5,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1E293B',
  },
  proText: {
    color: '#B45309',
  },
  proTextActive: {
    color: '#047857',
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2,
    borderColor: '#E2E8F0',
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
    borderTopColor: '#F59E0B',
    marginTop: -3,
  },
  navEmoji: {
    fontSize: 22,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#B45309',
  },
  treasuryTabContainer: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    paddingTop: 30,
  },
  treasuryTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E293B',
    marginTop: 12,
    letterSpacing: 0.5,
  },
  treasurySub: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
  },
  statsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderBottomWidth: 4,
    borderBottomColor: '#CBD5E1',
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
    color: '#475569',
  },
  statNumber: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1E293B',
  },
  statHighlight: {
    fontSize: 13,
    fontWeight: '900',
    color: '#2563EB',
  },
  statFree: {
    fontSize: 14,
    fontWeight: '900',
    color: '#10B981',
  },
  treasuryActionBtn: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
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
    color: '#B45309',
    letterSpacing: 0.5,
  },
  adFreePillFree: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  adFreePillActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  adFreeTextFree: {
    color: '#B45309',
  },
  adFreeTextActive: {
    color: '#047857',
  },
  treasuryAdFreeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    padding: 14,
    marginTop: 18,
    width: '100%',
    gap: 12,
  },
  treasuryAdFreeTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#047857',
    letterSpacing: 0.5,
  },
  treasuryAdFreeSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
    marginTop: 2,
  },
  treasuryUpgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 18,
    width: '100%',
    gap: 8,
    borderBottomWidth: 3,
    borderBottomColor: '#B45309',
  },
  treasuryUpgradeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  treasuryAlgoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    padding: 14,
    marginTop: 14,
    width: '100%',
    gap: 12,
  },
  treasuryAlgoTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#78350F',
    letterSpacing: 0.5,
  },
  treasuryAlgoSub: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 2,
  },
  treasuryAlgoActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  treasuryAlgoActiveText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#065F46',
    letterSpacing: 0.5,
  },
});
