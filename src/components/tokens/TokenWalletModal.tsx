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
  Scroll,
  ShieldCheck,
  X,
  Tv,
  Crown,
  Sparkles,
  CheckCircle2,
  Clock,
  Sliders,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { tokenWallet, TokenWalletState } from '../../services/tokenWallet';
import { adMobService } from '../../services/adMobService';
import { SquireMascot } from '../mascot/Mascots';

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

  useEffect(() => {
    if (visible) {
      tokenWallet.getWalletStatus().then(setWallet);
      const unsub = tokenWallet.subscribe(setWallet);
      return unsub;
    }
  }, [visible]);

  const handleWatchAd = async () => {
    setIsAdLoading(true);
    try {
      const result = await adMobService.showRewardedAd();
      if (!result.success && result.reason === 'limit_reached') {
        onClose();
        onOpenPlusModal();
      }
    } finally {
      setIsAdLoading(false);
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
                  {t('tokens.wallet_title', { defaultValue: 'ROYAL TOKENS' })}
                </Text>
                <Text style={styles.subtitle}>
                  {t('tokens.wallet_subtitle', { defaultValue: 'Learning Allowance & Passes' })}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
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
                    defaultValue: 'Available capacity to unlock and learn new cards in the arena.',
                  })}
                </Text>
              </View>
              <SquireMascot mood="cheering" size={80} />
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
                <Text style={styles.statCardValue}>{wallet.tokens}</Text>
                <Text style={styles.statCardSub}>
                  {t('tokens.tokens_words_desc', {
                    count: wallet.tokens * 10,
                    defaultValue: `${wallet.tokens * 10} words (+${wallet.tokenWordCredits} active)`,
                  })}
                </Text>
              </View>

              {/* Daily Scroll Pass */}
              <View style={styles.statCard}>
                <View style={styles.statCardHeader}>
                  <Scroll size={18} color="#0D9488" />
                  <Text style={styles.statCardTitle}>
                    {t('tokens.daily_scroll_title', { defaultValue: 'Daily Scroll' })}
                  </Text>
                </View>
                <Text style={styles.statCardValue}>{wallet.dailyPassWords}/5</Text>
                <Text style={styles.statCardSub}>
                  {t('tokens.daily_scroll_desc', {
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
                    {t('tokens.watch_ad_title', { defaultValue: 'Rewarded Scroll (AdMob)' })}
                  </Text>
                  <Text style={styles.adSectionSub}>
                    {t('tokens.watch_ad_desc', {
                      defaultValue: 'Watch 1 sponsored scroll to earn +1 Token (learn 10 words).',
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
                  <Crown size={18} color="#FFFFFF" />
                  <Text style={styles.plusUpgradeBtnText}>
                    {t('tokens.unlock_unlimited_plus', {
                      defaultValue: 'UNLOCK UNLIMITED WITH PLUS',
                    })}
                  </Text>
                </TouchableOpacity>
              )}
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
});
