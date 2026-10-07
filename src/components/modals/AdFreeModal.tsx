import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Shield, Check, Sparkles, X, Award, Zap, RefreshCw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { iapService, IAP_SKUS, AdFreeProductItem, DEFAULT_PRODUCTS } from '../../services/iapService';

import { colors } from '../../theme';

interface AdFreeModalProps {
  visible: boolean;
  onClose: () => void;
  isAdFree: boolean;
  onStatusChanged?: (isAdFree: boolean) => void;
}

export const AdFreeModal: React.FC<AdFreeModalProps> = ({
  visible,
  onClose,
  isAdFree,
  onStatusChanged,
}) => {
  const { t } = useTranslation();
  const [products, setProducts] = useState<AdFreeProductItem[]>(DEFAULT_PRODUCTS);
  const [loadingSku, setLoadingSku] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadProducts();
      setFeedbackMessage(null);
    }
  }, [visible]);

  const loadProducts = async () => {
    try {
      const items = await iapService.getProducts();
      setProducts(items);
    } catch (err) {
      console.warn('[AdFreeModal] Could not fetch products:', err);
    }
  };

  const handlePurchase = async (sku: string) => {
    setLoadingSku(sku);
    setFeedbackMessage(null);
    try {
      const res = await iapService.purchase(sku);
      if (res.success) {
        setFeedbackMessage(t('ad_free.purchase_success'));
        if (onStatusChanged) onStatusChanged(true);
      } else {
        setFeedbackMessage(res.message || t('common.loading'));
      }
    } catch (err: any) {
      setFeedbackMessage(err?.message || 'Transaction failed');
    } finally {
      setLoadingSku(null);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setFeedbackMessage(null);
    try {
      const res = await iapService.restore();
      if (res.restored) {
        setFeedbackMessage(t('ad_free.restored_success'));
        if (onStatusChanged) onStatusChanged(true);
      } else {
        setFeedbackMessage(t('ad_free.no_purchases'));
      }
    } catch (err: any) {
      setFeedbackMessage(err?.message || 'Restore failed');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleToggleSimulated = async () => {
    const nextState = !isAdFree;
    await iapService.setSimulatedAdFree(nextState);
    if (onStatusChanged) onStatusChanged(nextState);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Shield size={22} color={colors.primary[700]} />
              </View>
              <View>
                <Text style={styles.title}>{t('ad_free.modal_title')}</Text>
                <Text style={styles.subtitle}>{t('ad_free.modal_subtitle')}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={20} color={colors.primary[900]} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Active Status Badge if already Ad-Free */}
            {isAdFree ? (
              <View style={styles.activeBanner}>
                <Award size={28} color={colors.success[700]} />
                <Text style={styles.activeTitle}>{t('ad_free.purchased_badge')}</Text>
                <Text style={styles.activeSub}>
                  {t('ad_free.benefit_1_sub')}
                </Text>
              </View>
            ) : (
              <>
                {/* Benefits List */}
                <View style={styles.benefitsCard}>
                  <View style={styles.benefitRow}>
                    <View style={styles.checkCircle}>
                      <Check size={14} color={colors.success[700]} />
                    </View>
                    <View style={styles.benefitTextCol}>
                      <Text style={styles.benefitTitle}>{t('ad_free.benefit_1')}</Text>
                      <Text style={styles.benefitDesc}>{t('ad_free.benefit_1_sub')}</Text>
                    </View>
                  </View>

                  <View style={styles.benefitRow}>
                    <View style={styles.checkCircle}>
                      <Check size={14} color={colors.success[700]} />
                    </View>
                    <View style={styles.benefitTextCol}>
                      <Text style={styles.benefitTitle}>{t('ad_free.benefit_2')}</Text>
                      <Text style={styles.benefitDesc}>{t('ad_free.benefit_2_sub')}</Text>
                    </View>
                  </View>

                  <View style={styles.benefitRow}>
                    <View style={styles.checkCircle}>
                      <Check size={14} color={colors.success[700]} />
                    </View>
                    <View style={styles.benefitTextCol}>
                      <Text style={styles.benefitTitle}>{t('ad_free.benefit_3')}</Text>
                      <Text style={styles.benefitDesc}>{t('ad_free.benefit_3_sub')}</Text>
                    </View>
                  </View>
                </View>

                {/* Purchase Options */}
                <View style={styles.plansSection}>
                  {/* Monthly Patron Pass */}
                  <TouchableOpacity
                    style={[styles.planCard, styles.planCardFeatured]}
                    activeOpacity={0.85}
                    onPress={() => handlePurchase(IAP_SKUS.AD_FREE_MONTHLY)}
                    disabled={loadingSku !== null}
                  >
                    <View style={styles.planHeader}>
                      <View style={styles.planBadge}>
                        <Sparkles size={12} color={colors.neutral[0]} />
                        <Text style={styles.planBadgeText}>MONTHLY SUBSCRIPTION</Text>
                      </View>
                      <Text style={styles.planPrice}>
                        {products.find((p) => p.id === IAP_SKUS.AD_FREE_MONTHLY)?.price || t('ad_free.price_monthly')}
                      </Text>
                    </View>
                    <Text style={styles.planTitle}>{t('ad_free.plan_monthly')}</Text>
                    <Text style={styles.planSub}>{t('ad_free.plan_monthly_sub')}</Text>

                    <View style={styles.planBtn}>
                      {loadingSku === IAP_SKUS.AD_FREE_MONTHLY ? (
                        <ActivityIndicator size="small" color={colors.neutral[0]} />
                      ) : (
                        <>
                          <Zap size={15} color={colors.neutral[0]} />
                          <Text style={styles.planBtnText}>SUBSCRIBE MONTHLY</Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Status / Feedback Banner */}
            {feedbackMessage && (
              <View style={styles.feedbackBanner}>
                <Text style={styles.feedbackText}>{feedbackMessage}</Text>
              </View>
            )}

            {/* Restore Purchases Button */}
            <TouchableOpacity
              style={styles.restoreBtn}
              onPress={handleRestore}
              disabled={isRestoring}
              activeOpacity={0.7}
            >
              {isRestoring ? (
                <ActivityIndicator size="small" color={colors.neutral[500]} />
              ) : (
                <View style={styles.restoreBtnContent}>
                  <RefreshCw size={14} color={colors.neutral[500]} />
                  <Text style={styles.restoreBtnText}>{t('ad_free.restore_purchases')}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Test Simulation Toggle */}
            <TouchableOpacity
              style={styles.simulationBtn}
              onPress={handleToggleSimulated}
              activeOpacity={0.7}
            >
              <Text style={styles.simulationBtnText}>
                TEST TOGGLE: {isAdFree ? 'DISABLE AD-FREE' : 'ENABLE AD-FREE (FREE SIMULATION)'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: 24,
    borderTopWidth: 2,
    borderTopColor: colors.primary[500],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.neutral[100],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary[200],
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.neutral[800],
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.neutral[100],
  },
  body: {
    paddingHorizontal: 20,
  },
  bodyContent: {
    paddingTop: 16,
    paddingBottom: 10,
    gap: 16,
  },
  activeBanner: {
    backgroundColor: colors.success[50],
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.success[200],
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  activeTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.success[700],
    letterSpacing: 0.5,
  },
  activeSub: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success[800],
    textAlign: 'center',
  },
  benefitsCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    padding: 16,
    gap: 14,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.success[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  benefitTextCol: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[800],
  },
  benefitDesc: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
    marginTop: 2,
  },
  plansSection: {
    gap: 12,
  },
  planCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    padding: 16,
    borderBottomWidth: 3,
    borderBottomColor: colors.neutral[300],
  },
  planCardFeatured: {
    borderColor: colors.primary[500],
    borderBottomColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[600],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  planBadgeText: {
    color: colors.neutral[0],
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  monthlyTag: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  monthlyTagText: {
    color: colors.neutral[600],
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary[800],
  },
  planPriceSecondary: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.neutral[800],
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.neutral[800],
  },
  planSub: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
    marginTop: 2,
    marginBottom: 12,
  },
  planBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary[700],
  },
  planBtnText: {
    color: colors.neutral[0],
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  planBtnSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[100],
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary[200],
  },
  planBtnTextSecondary: {
    color: colors.primary[900],
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  feedbackBanner: {
    backgroundColor: colors.primary[100],
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.primary[300],
    alignItems: 'center',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary[900],
    textAlign: 'center',
  },
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  restoreBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  restoreBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.neutral[500],
    letterSpacing: 0.5,
  },
  simulationBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  simulationBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.neutral[400],
    letterSpacing: 0.5,
  },
});
