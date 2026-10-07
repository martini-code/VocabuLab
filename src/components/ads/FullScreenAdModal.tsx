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
import { Shield, Sparkles, X, Check, Award, Compass } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { LabMascot } from '../mascot/Mascots';

interface FullScreenAdModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenAdFreeModal: () => void;
}

/**
 * Full-screen interstitial advertisement shown to free-tier users between review sessions.
 * Follows strict NO EMOJI design rules with a 5-second countdown before dismissal.
 */
export const FullScreenAdModal: React.FC<FullScreenAdModalProps> = ({
  visible,
  onClose,
  onOpenAdFreeModal,
}) => {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(5);
  const [canDismiss, setCanDismiss] = useState(false);

  useEffect(() => {
    if (visible) {
      setCountdown(5);
      setCanDismiss(false);

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanDismiss(true);
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
      onRequestClose={canDismiss ? onClose : undefined}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

        {/* Top Bar with Dismiss / Countdown */}
        <View style={styles.topBar}>
          <View style={styles.sponsorBadge}>
            <Shield size={14} color="#F59E0B" />
            <Text style={styles.sponsorBadgeText}>
              {t('ad_free.banner_badge', { defaultValue: 'SPONSORED LAB CARD' })}
            </Text>
          </View>

          {canDismiss ? (
            <TouchableOpacity
              style={styles.closeBtnActive}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.closeBtnText}>
                {t('ad_free.interstitial_skip_ready', { defaultValue: 'RESUME EXPERIMENT' })}
              </Text>
              <X size={16} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.countdownPill}>
              <Text style={styles.countdownText}>
                {t('ad_free.interstitial_skip_countdown', { count: countdown, defaultValue: `Skip in ${countdown}s` })}
              </Text>
            </View>
          )}
        </View>

        {/* Full Screen Advertisement Body */}
        <View style={styles.content}>
          <View style={styles.adCard}>
            <View style={styles.illustrationWrap}>
              <LabMascot mood="thinking" size={140} />
            </View>

            <View style={styles.merchantHeader}>
              <Award size={22} color="#F59E0B" />
              <Text style={styles.merchantGuildTitle}>
                {t('ad_free.interstitial_title', { defaultValue: 'OUR RESEARCH SPONSORS' })}
              </Text>
            </View>

            <Text style={styles.adHeadline}>
              {t('ad_free.interstitial_subtitle', { defaultValue: 'Expand Your Field of Knowledge' })}
            </Text>

            <Text style={styles.adDescription}>
              {t('ad_free.interstitial_desc', {
                defaultValue:
                  'This free training session is made possible by our Lab Sponsors. Keep your study streak alive and master 50 global languages offline!',
              })}
            </Text>

            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Check size={14} color="#10B981" />
                <Text style={styles.featureText}>100% Offline SQLite Flashcards</Text>
              </View>
              <View style={styles.featureItem}>
                <Check size={14} color="#10B981" />
                <Text style={styles.featureText}>FSRS v4.2 Spaced Repetition</Text>
              </View>
              <View style={styles.featureItem}>
                <Check size={14} color="#10B981" />
                <Text style={styles.featureText}>50 Language Multilingual Lab</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bottom Bar: Action to Go Ad-Free Forever */}
        <View style={styles.bottomBar}>
          <Text style={styles.bottomPrompt}>
            {t('ad_free.interstitial_upgrade_cta', {
              defaultValue: 'Never want to watch full-screen cards again?',
            })}
          </Text>

          <TouchableOpacity
            style={styles.upgradeBtn}
            activeOpacity={0.85}
            onPress={() => {
              onClose();
              onOpenAdFreeModal();
            }}
          >
            <Sparkles size={16} color="#FFFFFF" />
            <Text style={styles.upgradeBtnText}>
              {t('ad_free.go_ad_free', { defaultValue: 'UPGRADE TO AD-FREE' })}
            </Text>
          </TouchableOpacity>

          {canDismiss && (
            <TouchableOpacity
              style={styles.secondaryDismissBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryDismissText}>
                {t('ad_free.interstitial_skip_ready', { defaultValue: 'CONTINUE FREE TRAINING' })}
              </Text>
            </TouchableOpacity>
          )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sponsorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sponsorBadgeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  countdownPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  countdownText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtnActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  adCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#334155',
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  illustrationWrap: {
    marginBottom: 16,
  },
  merchantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  merchantGuildTitle: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  adHeadline: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  adDescription: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  featuresList: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 10,
  },
  bottomPrompt: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    borderBottomWidth: 3,
    borderBottomColor: '#B45309',
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  secondaryDismissBtn: {
    paddingVertical: 6,
  },
  secondaryDismissText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
