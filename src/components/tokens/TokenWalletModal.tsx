import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Coins,
  TestTube,
  ShieldCheck,
  X,
  Tv,
  Rocket,
  Sparkles,
  CheckCircle2,
  Clock,
  Sliders,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { tokenWallet, TokenWalletState } from '../../services/tokenWallet';
import { TOKEN_CONFIG } from '../../config/secrets';
import { adMobService } from '../../services/adMobService';
import { LabMascot } from '../mascot/Mascots';

interface TokenWalletModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenPlusModal: () => void;
}

export const TokenWalletModal: React.FC<TokenWalletModalProps> = ({
  visible,
  onClose,
  onOpenPlusModal,
}) => {
  const { t } = useTranslation();
  const [wallet, setWallet] = useState<TokenWalletState | null>(null);
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [isTestMode, setIsTestMode] = useState(() => adMobService.isTestModeEnabled?.() ?? true);

  useEffect(() => {
    if (visible) {
      tokenWallet.getWalletStatus().then(setWallet);
      setIsTestMode(adMobService.isTestModeEnabled?.() ?? true);
      const unsub = tokenWallet.subscribe(setWallet);
      return unsub;
    }
  }, [visible]);

  const handleWatchAd = async () => {
    setIsAdLoading(true);
    try {
      const result = await adMobService.showRewardedAd();
      if (!result.success) {
        if (result.reason === 'limit_reached') {
          onClose();
          onOpenPlusModal();
        } else if (result.reason === 'unavailable') {
          Alert.alert(
            t('tokens.ad_not_ready_title', { defaultValue: 'Ad Not Ready' }),
            t('tokens.ad_not_ready_msg', {
              defaultValue: 'The ad is still preparing. Please try again in a few moments.',
            })
          );
        } else if (result.reason === 'error') {
          Alert.alert(
            t('tokens.ad_error_title', { defaultValue: 'Ad Unavailable' }),
            t('tokens.ad_error_msg', {
              defaultValue: 'Unable to load ad right now. Please check your network connection and try again.',
            })
          );
        }
      }
    } finally {
      setIsAdLoading(false);
    }
  };

  const handleToggleAdMode = () => {
    if (isTestMode) {
      Alert.alert(
        'Activate Production Live Ads?',
        'Warning: Google AdMob policy strictly forbids viewing or clicking your own live ads. Doing so on your development device will result in account suspension or ban.\n\nOnly activate Live Ads for genuine end-user store releases.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Activate Live Ads',
            style: 'destructive',
            onPress: async () => {
              await adMobService.setTestMode(false);
              setIsTestMode(false);
            },
          },
        ]
      );
    } else {
      adMobService.setTestMode(true);
      setIsTestMode(true);
    }
  };

  const handleInspectMediation = async () => {
    const res = await adMobService.openAdInspector();
    if (!res.success && res.error) {
      Alert.alert(
        'Google AdMob Mediation',
        `${res.error}\n\nMediation adapters (Meta, AppLovin, Unity, Mintegral, ironSource, InMobi, Pangle, Vungle, DT Exchange, Yandex) are active in native builds.`
      );
    }
  };

  if (!wallet) return null;

  const adsRemaining = Math.max(0, wallet.maxDailyAds - wallet.adsWatchedToday);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                style={styles.iconCircle}
                onLongPress={handleInspectMediation}
                activeOpacity={0.8}
              >
                <Coins size={22} color="#D97706" />
              </TouchableOpacity>
              <View>
                <Text style={styles.title}>
                  {t('tokens.wallet_title', { defaultValue: 'LAB TOKENS' })}
                </Text>
                <Text style={styles.subtitle}>
                  {t('tokens.wallet_subtitle', { defaultValue: 'Learning Allowance & Passes' })}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              testID="modal-close-btn"
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* Total Allowance Hero Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroTextCol}>
                <Text style={styles.heroLabel}>
                  {t('tokens.total_allowance_label', { defaultValue: 'WORDS READY TO LEARN' })}
                </Text>
                <Text style={styles.heroValue}>{wallet.totalWordsAllowance}</Text>
                <Text style={styles.heroSub}>
                  {t('tokens.allowance_desc', {
                    defaultValue: 'Available capacity to unlock and learn new cards in the lab.',
                  })}
                </Text>
              </View>
              <LabMascot mood="cheering" size={80} />
            </View>

            {/* Breakdown Cards */}
            <View style={styles.breakdownRow}>
              {/* Tokens Pill */}
              <View style={styles.statCard}>
                <View style={styles.statCardHeader}>
                  <Coins size={18} color="#D97706" />
                  <Text style={styles.statCardTitle}>
                    {t('tokens.token_units', { defaultValue: 'Tokens' })}
                  </Text>
                </View>
                <Text style={styles.statCardValue}>
                  {wallet.tokens}/{TOKEN_CONFIG.MAX_TOKENS_HELD}
                </Text>
                <Text style={styles.statCardSub}>
                  {t('tokens.tokens_words_desc', {
                    count: wallet.tokens * 10,
                    defaultValue: `${wallet.tokens * 10} words (+${wallet.tokenWordCredits} active)`,
                  })}
                </Text>
              </View>

              {/* Daily Card Pass */}
              <View style={styles.statCard}>
                <View style={styles.statCardHeader}>
                  <TestTube size={18} color="#0D9488" />
                  <Text style={styles.statCardTitle}>
                    {t('tokens.daily_card_title', { defaultValue: 'Daily Card' })}
                  </Text>
                </View>
                <Text style={styles.statCardValue}>
                  {wallet.dailyPassWords}/{TOKEN_CONFIG.DAILY_PASS_WORDS}
                </Text>
                <Text style={styles.statCardSub}>
                  {t('tokens.daily_card_desc', {
                    defaultValue: 'Free daily pass (non-cumulative)',
                  })}
                </Text>
              </View>
            </View>

            {/* Rewarded Ads Section */}
            <View style={styles.adSectionCard}>
              <View style={styles.adSectionHeader}>
                <Tv size={20} color="#2563EB" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.adSectionTitle}>
                    {t('tokens.watch_ad_title', { defaultValue: 'Rewarded Card (AdMob)' })}
                  </Text>
                  <Text style={styles.adSectionSub}>
                    {t('tokens.watch_ad_desc', {
                      defaultValue: 'Watch 1 sponsored card to earn +1 Token (learn 10 words).',
                    })}
                  </Text>
                </View>
              </View>

              <View style={styles.adProgressRow}>
                <Clock size={14} color="#64748B" />
                <Text style={styles.adProgressText}>
                  {wallet.canWatchAd
                    ? t('tokens.ads_remaining', {
                        count: adsRemaining,
                        defaultValue: `${adsRemaining} of ${wallet.maxDailyAds} rewarded ads left today`,
                      })
                    : wallet.tokens >= TOKEN_CONFIG.MAX_TOKENS_HELD
                    ? t('tokens.wallet_full', {
                        defaultValue: `Token capacity full (${TOKEN_CONFIG.MAX_TOKENS_HELD}/${TOKEN_CONFIG.MAX_TOKENS_HELD} max)`,
                      })
                    : t('tokens.ads_limit_reached', {
                        defaultValue: 'Daily ad limit reached (3/3 completed)',
                      })}
                </Text>
              </View>

              {wallet.canWatchAd ? (
                <TouchableOpacity
                  style={[styles.actionBtn, isAdLoading && styles.actionBtnDisabled]}
                  onPress={handleWatchAd}
                  disabled={isAdLoading}
                  activeOpacity={0.8}
                >
                  <Coins size={18} color="#78350F" />
                  <Text style={styles.actionBtnText}>
                    {t('tokens.watch_ad_cta', { defaultValue: 'WATCH AD (+1 TOKEN)' })}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.plusUpgradeBtn}
                  onPress={() => {
                    onClose();
                    onOpenPlusModal();
                  }}
                  activeOpacity={0.8}
                >
                  <Rocket size={18} color="#FFFFFF" />
                  <Text style={styles.plusUpgradeBtnText}>
                    {t('tokens.unlock_unlimited_plus', {
                      defaultValue: 'UNLOCK UNLIMITED WITH PLUS',
                    })}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* AdMob Safe Mode Status & Live Toggle */}
            <View style={styles.adModeContainer}>
              <View style={[styles.adModeBadge, isTestMode ? styles.adModeBadgeSafe : styles.adModeBadgeLive]}>
                <ShieldCheck size={14} color={isTestMode ? '#16A34A' : '#EA580C'} />
                <Text style={[styles.adModeBadgeText, { color: isTestMode ? '#16A34A' : '#EA580C' }]}>
                  {isTestMode ? 'Safe Mode: Test Ads (No Ban Risk)' : 'Live Production Ads Active'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.adModeToggleBtn}
                onPress={handleToggleAdMode}
                activeOpacity={0.7}
              >
                <Text style={styles.adModeToggleText}>
                  {isTestMode ? 'Switch to Live Ads' : 'Switch to Safe Mode'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* AdMob Mediation Inspector Trigger */}
            <TouchableOpacity
              style={styles.inspectorBtn}
              onPress={handleInspectMediation}
              activeOpacity={0.7}
            >
              <Sliders size={13} color="#92400E" />
              <Text style={styles.inspectorBtnText}>
                {t('tokens.inspect_mediation', { defaultValue: 'Inspect AdMob Mediation' })}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  inspectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  inspectorBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    textDecorationLine: 'underline',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FEFCE8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: 30,
    borderTopWidth: 3,
    borderTopColor: '#F59E0B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#78350F',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 14,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 2,
    borderColor: '#FDE68A',
    shadowColor: '#78350F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  heroTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  heroValue: {
    fontSize: 36,
    fontWeight: '900',
    color: '#78350F',
    marginVertical: 2,
  },
  heroSub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  statCardValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  statCardSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  adSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  adSectionHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  adSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  adSectionSub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  adProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  adProgressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#78350F',
    letterSpacing: 0.5,
  },
  plusUpgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  plusUpgradeBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  adModeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  adModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  adModeBadgeSafe: {
    opacity: 1,
  },
  adModeBadgeLive: {
    opacity: 1,
  },
  adModeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  adModeToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
  },
  adModeToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
});
