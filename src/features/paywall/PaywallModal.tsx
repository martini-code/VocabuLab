import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { unlockKingdomPass, restoreRoyalPurchases } from '../../services/purchases';
import { SquireMascot } from '../../components/mascot/Mascots';
import { ChunkyButton } from '../../components/ui/ChunkyButton';
import { ParchmentCard } from '../../components/ui/ParchmentCard';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'sovereign_lifetime' | 'knight_annual'>('sovereign_lifetime');
  const [purchasing, setPurchasing] = useState(false);

  const handlePurchase = async () => {
    setPurchasing(true);
    const success = await unlockKingdomPass(selectedPlan);
    setPurchasing(false);

    if (success) {
      Alert.alert(
        '⚔️ Royal Decree Granted!',
        'The King has conferred full Pro access to the Forbidden Archives and all future kingdom realms.',
        [{ text: 'Huzzah!', onPress: onSuccess }]
      );
      onClose();
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    const restored = await restoreRoyalPurchases();
    setPurchasing(false);
    if (restored) {
      Alert.alert('🛡️ Restored', 'Thy royal privileges have been successfully recognized.');
      onSuccess();
      onClose();
    } else {
      Alert.alert('Scroll Not Found', 'No prior royal decree was found for this guild account.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Close Crown Button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <ScrollView contentContainerStyle={styles.scroll}>
            {/* Mascot Herald */}
            <View style={styles.heraldHeader}>
              <SquireMascot mood="cheering" size={100} />
              <Text style={styles.title}>THE KING'S GUILD PASS</Text>
              <Text style={styles.subtitle}>
                Unlock the Forbidden Archives, C1-C2 Masteries, and Sovereign Privileges
              </Text>
            </View>

            {/* Benefit Scrolls */}
            <ParchmentCard variant="aged" style={styles.benefitsCard}>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>🗝️</Text>
                <View style={styles.benefitTextCol}>
                  <Text style={styles.benefitTitle}>Forbidden Royal Archives</Text>
                  <Text style={styles.benefitDesc}>Complete access to C1 & C2 advanced vocabulary domains.</Text>
                </View>
              </View>

              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>⚡</Text>
                <View style={styles.benefitTextCol}>
                  <Text style={styles.benefitTitle}>Zero-Latency Offline Vault</Text>
                  <Text style={styles.benefitDesc}>Unlimited local SQLite reviews with FSRS optimization.</Text>
                </View>
              </View>

              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>👑</Text>
                <View style={styles.benefitTextCol}>
                  <Text style={styles.benefitTitle}>Kingdom Patron Seal</Text>
                  <Text style={styles.benefitDesc}>Support $0/month serverless offline-first architecture.</Text>
                </View>
              </View>
            </ParchmentCard>

            {/* Plan Options */}
            <View style={styles.plansContainer}>
              {/* Sovereign Lifetime */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setSelectedPlan('sovereign_lifetime')}
                style={[
                  styles.planOption,
                  selectedPlan === 'sovereign_lifetime' && styles.planOptionSelected,
                ]}
              >
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>BEST VALUE • ROYALTY FOR LIFE</Text>
                </View>
                <View style={styles.planDetails}>
                  <View>
                    <Text style={styles.planName}>Sovereign Lifetime</Text>
                    <Text style={styles.planSub}>One-time tribute, forever access</Text>
                  </View>
                  <Text style={styles.planPrice}>$29.99</Text>
                </View>
              </TouchableOpacity>

              {/* Knight Annual */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setSelectedPlan('knight_annual')}
                style={[
                  styles.planOption,
                  selectedPlan === 'knight_annual' && styles.planOptionSelected,
                ]}
              >
                <View style={styles.planDetails}>
                  <View>
                    <Text style={styles.planName}>Knight Annual</Text>
                    <Text style={styles.planSub}>$1.66 per month (billed yearly)</Text>
                  </View>
                  <Text style={styles.planPrice}>$19.99 / yr</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Action Button */}
            <ChunkyButton
              title={purchasing ? 'CONFIRMING WITH CROWN...' : 'CLAIM GUILD PASS'}
              subtitle="Instant unlock across all devices"
              color="amber"
              disabled={purchasing}
              onPress={handlePurchase}
              style={{ width: '100%', marginTop: 18 }}
            />

            {/* Restore Purchase */}
            <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
              <Text style={styles.restoreText}>Restore Existing Royal Seal</Text>
            </TouchableOpacity>

            <Text style={styles.legalNotice}>
              Secured natively via App Store / Google Play via RevenueCat. Cancel anytime.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '90%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    borderTopWidth: 4,
    borderColor: '#F59E0B',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#64748B',
  },
  scroll: {
    paddingBottom: 30,
    alignItems: 'center',
  },
  heraldHeader: {
    alignItems: 'center',
    marginVertical: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E293B',
    marginTop: 10,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '600',
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  benefitsCard: {
    width: '100%',
    marginTop: 14,
    padding: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  benefitIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  benefitTextCol: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  benefitDesc: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  plansContainer: {
    width: '100%',
    marginTop: 18,
    gap: 10,
  },
  planOption: {
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 4,
    borderBottomColor: '#CBD5E1',
    position: 'relative',
  },
  planOptionSelected: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
    borderBottomColor: '#D97706',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 16,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  planDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
  },
  planSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#B45309',
  },
  restoreBtn: {
    marginTop: 14,
    padding: 6,
  },
  restoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  legalNotice: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
});
