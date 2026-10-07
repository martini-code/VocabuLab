import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { AlertCircle, Tv, Rocket, X, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { tokenWallet, TokenWalletState } from '../../services/tokenWallet';
import { TOKEN_CONFIG } from '../../config/secrets';
import { adMobService } from '../../services/adMobService';
import { LabMascot } from '../mascot/Mascots';

interface InsufficientTokensModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenPlusModal: () => void;
  requiredWords?: number;
  onSuccessLearn?: () => void;
}

export const InsufficientTokensModal: React.FC<InsufficientTokensModalProps> = ({
  visible,
  onClose,
  onOpenPlusModal,
  requiredWords = 1,
  onSuccessLearn,
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
      if (result.success) {
        // If now they have enough words, call onSuccessLearn or close
        const updated = await tokenWallet.getWalletStatus();
        if (updated.totalWordsAllowance >= requiredWords && onSuccessLearn) {
          onClose();
          onSuccessLearn();
        }
      } else if (result.reason === 'limit_reached') {
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
            defaultValue:
              'Unable to load ad right now. Please check your network connection and try again.',
          })
        );
      }
    } finally {
      setIsAdLoading(false);
    }
  };

  if (!visible || !wallet) return null;

  const canWatchAd = wallet.canWatchAd;
  const adsRemaining = Math.max(0, wallet.maxDailyAds - wallet.adsWatchedToday);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity
            testID="modal-close-btn"
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <X size={20} color="#64748B" />
          </TouchableOpacity>

          <View style={styles.mascotContainer}>
            <LabMascot size={72} mood="thinking" />
          </View>

          <View style={styles.badgeRow}>
            <View style={styles.warningBadge}>
              <AlertCircle size={14} color="#D97706" />
              <Text style={styles.warningBadgeText}>
                {t('tokens.insufficient_badge', { defaultValue: 'ALLOWANCE NEEDED' })}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>
            {t('tokens.insufficient_title', { defaultValue: 'More Words Needed' })}
          </Text>

          <Text style={styles.description}>
            {t('tokens.insufficient_desc', {
              defaultValue:
                'You need {{required}} words allowance to learn this selection, but you currently have {{available}} words available.',
              required: requiredWords,
              available: wallet.totalWordsAllowance,
            })}
          </Text>

          {/* Stat Pill */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>
                {t('tokens.required_label', { defaultValue: 'Required' })}
              </Text>
              <Text style={[styles.statValue, { color: '#EF4444' }]}>{requiredWords}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>
                {t('tokens.available_label', { defaultValue: 'Available' })}
              </Text>
              <Text style={[styles.statValue, { color: '#D97706' }]}>
                {wallet.totalWordsAllowance}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {canWatchAd ? (
              <>
                <TouchableOpacity
                  style={[styles.watchAdBtn, isAdLoading && styles.btnDisabled]}
                  onPress={handleWatchAd}
                  disabled={isAdLoading}
                  activeOpacity={0.8}
                >
                  {isAdLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Tv size={18} color="#FFFFFF" />
                      <Text style={styles.watchAdBtnText}>
                        {t('tokens.watch_ad_cta', {
                          defaultValue: 'Watch Ad (+1 Token / 10 Words)',
                        })}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={styles.adSubtext}>
                  {t('tokens.ads_remaining_counter', {
                    defaultValue: '{{remaining}} of {{max}} ads remaining today',
                    remaining: adsRemaining,
                    max: wallet.maxDailyAds,
                  })}
                </Text>

                <TouchableOpacity
                  style={styles.plusOutlineBtn}
                  onPress={() => {
                    onClose();
                    onOpenPlusModal();
                  }}
                  activeOpacity={0.7}
                >
                  <Rocket size={16} color="#4F46E5" />
                  <Text style={styles.plusOutlineBtnText}>
                    {t('tokens.unlock_unlimited_plus', {
                      defaultValue: 'Or Unlock Unlimited with Plus',
                    })}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.limitReachedBox}>
                  <Text style={styles.limitReachedTitle}>
                    {t('tokens.daily_ads_limit_reached', {
                      defaultValue: 'Daily Ad Limit Reached',
                    })}
                  </Text>
                  <Text style={styles.limitReachedDesc}>
                    {wallet.tokens >= TOKEN_CONFIG.MAX_TOKENS_HELD
                      ? t('tokens.token_pouch_full_desc', {
                          defaultValue: `You are holding the maximum of ${TOKEN_CONFIG.MAX_TOKENS_HELD} tokens. Spend your current allowance or unlock infinite learning with Plus.`,
                        })
                      : t('tokens.daily_ads_limit_reached_desc', {
                          defaultValue:
                            'You have watched all 3 ads for today. Reset occurs tomorrow or unlock infinite learning with Plus.',
                        })}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.plusFullBtn}
                  onPress={() => {
                    onClose();
                    onOpenPlusModal();
                  }}
                  activeOpacity={0.8}
                >
                  <Rocket size={18} color="#FFFFFF" />
                  <Text style={styles.plusFullBtnText}>
                    {t('tokens.upgrade_to_plus_cta', {
                      defaultValue: 'Upgrade to Plus',
                    })}
                  </Text>
                  <Sparkles size={16} color="#FEF08A" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    zIndex: 10,
  },
  mascotContainer: {
    marginBottom: 12,
    marginTop: 8,
  },
  badgeRow: {
    marginBottom: 8,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  warningBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#CBD5E1',
  },
  actionsContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
  },
  watchAdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  watchAdBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  adSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  plusOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    width: '100%',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0E7FF',
    backgroundColor: '#EEF2FF',
    marginTop: 4,
  },
  plusOutlineBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  limitReachedBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 6,
  },
  limitReachedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B91C1C',
    marginBottom: 4,
  },
  limitReachedDesc: {
    fontSize: 12,
    color: '#7F1D1D',
    textAlign: 'center',
    lineHeight: 16,
  },
  plusFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  plusFullBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
