import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, Sparkles, X, Check, Award, Coins } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { SquireMascot } from '../mascot/Mascots';

interface RewardedAdModalProps {
  visible: boolean;
  onReward: () => void;
  onClose: () => void;
}

export const RewardedAdModal: React.FC<RewardedAdModalProps> = ({
  visible,
  onReward,
  onClose,
}) => {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(5);
  const [rewardReady, setRewardReady] = useState(false);

  useEffect(() => {
    if (visible) {
      setCountdown(5);
      setRewardReady(false);

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setRewardReady(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={rewardReady ? onClose : undefined}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.sponsorBadge}>
            <Coins size={14} color="#F59E0B" />
            <Text style={styles.sponsorBadgeText}>
              {t('tokens.ad_sponsored_badge', { defaultValue: 'REWARDED ADVERTISEMENT' })}
            </Text>
          </View>

          {rewardReady ? (
            <TouchableOpacity
              style={styles.claimBtnActive}
              onPress={() => {
                onReward();
                onClose();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.claimBtnText}>
                {t('tokens.claim_token', { defaultValue: 'CLAIM +1 TOKEN' })}
              </Text>
              <Check size={16} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.countdownPill}>
              <Text style={styles.countdownText}>
                {t('tokens.ad_countdown', { count: countdown, defaultValue: `Reward in ${countdown}s` })}
              </Text>
            </View>
          )}
        </View>

        {/* Ad Body */}
        <View style={styles.content}>
          <View style={styles.adCard}>
            <View style={styles.illustrationWrap}>
              <SquireMascot mood={rewardReady ? 'cheering' : 'thinking'} size={140} />
            </View>

            <View style={styles.tokenPill}>
              <Coins size={18} color="#D97706" />
              <Text style={styles.tokenPillText}>+1 TOKEN (+10 WORDS)</Text>
            </View>

            <Text style={styles.adHeadline}>
              {rewardReady
                ? t('tokens.ad_completed_title', { defaultValue: 'Scroll Studied! Token Ready!' })
                : t('tokens.ad_in_progress_title', { defaultValue: 'Support Vocab Keep & Earn Words' })}
            </Text>

            <Text style={styles.adTagline}>
              {rewardReady
                ? t('tokens.ad_completed_sub', { defaultValue: 'Thy token has been earned. Tap above to claim 10 new words!' })
                : t('tokens.ad_in_progress_sub', { defaultValue: 'Watching sponsored scrolls fuels the kingdom archives and grants learning tokens.' })}
            </Text>

            {rewardReady && (
              <TouchableOpacity
                style={styles.claimActionBtn}
                onPress={() => {
                  onReward();
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Coins size={20} color="#78350F" />
                <Text style={styles.claimActionText}>
                  {t('tokens.claim_token_cta', { defaultValue: 'COLLECT TOKEN & RESUME' })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  sponsorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sponsorBadgeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  countdownPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#475569',
  },
  countdownText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  claimBtnActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  claimBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  adCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  illustrationWrap: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  tokenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  tokenPillText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  adHeadline: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  adTagline: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  claimActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: '100%',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  claimActionText: {
    color: '#78350F',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
