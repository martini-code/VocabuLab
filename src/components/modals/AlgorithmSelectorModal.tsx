import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Sparkles,
  BookOpen,
  Layers,
  Check,
  X,
  Zap,
  Info,
  Star,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { srsManager, AlgorithmId, AlgorithmMeta } from '../../srs';

interface AlgorithmSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onAlgorithmChanged?: (id: AlgorithmId) => void;
}

export const AlgorithmSelectorModal: React.FC<AlgorithmSelectorModalProps> = ({
  visible,
  onClose,
  onAlgorithmChanged,
}) => {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<AlgorithmId>(srsManager.getActiveId());
  const algorithms = srsManager.getAvailableAlgorithms();

  useEffect(() => {
    setActiveId(srsManager.getActiveId());
    const unsubscribe = srsManager.subscribe((newId) => {
      setActiveId(newId);
    });
    return unsubscribe;
  }, [visible]);

  const handleSelect = async (id: AlgorithmId) => {
    setActiveId(id);
    await srsManager.setActiveAlgorithm(id);
    if (onAlgorithmChanged) {
      onAlgorithmChanged(id);
    }
  };

  const renderIcon = (id: AlgorithmId, size = 20, color = '#D97706') => {
    switch (id) {
      case 'fsrs':
        return <Sparkles size={size} color={color} />;
      case 'sm2':
        return <BookOpen size={size} color={color} />;
      case 'leitner':
        return <Layers size={size} color={color} />;
      default:
        return <Zap size={size} color={color} />;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.headerTitleRow}>
                <Zap size={20} color="#D97706" />
                <Text style={styles.modalTitle}>{t('srs.modal_title')}</Text>
              </View>
              <Text style={styles.modalSubtitle}>{t('srs.modal_subtitle')}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Algorithm Cards */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {algorithms.map((algo) => {
              const isSelected = activeId === algo.id;

              return (
                <TouchableOpacity
                  key={algo.id}
                  activeOpacity={0.88}
                  style={[
                    styles.algoCard,
                    isSelected && styles.algoCardActive,
                  ]}
                  onPress={() => handleSelect(algo.id)}
                >
                  {/* Top Badge & Selection Indicator */}
                  <View style={styles.algoCardTopRow}>
                    <View style={styles.badgeGroup}>
                      <View
                        style={[
                          styles.categoryBadge,
                          algo.isDefault && styles.defaultBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryBadgeText,
                            algo.isDefault && styles.defaultBadgeText,
                          ]}
                        >
                          {algo.badgeLabel}
                        </Text>
                      </View>
                    </View>

                    {isSelected ? (
                      <View style={styles.selectedPill}>
                        <Check size={14} color="#059669" />
                        <Text style={styles.selectedPillText}>
                          {t('srs.active_badge')}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.selectCtaPill}>
                        <Text style={styles.selectCtaText}>
                          {t('srs.switch_cta')}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Title & Icon */}
                  <View style={styles.algoTitleRow}>
                    <View style={styles.algoIconBox}>
                      {renderIcon(algo.id, 22, isSelected ? '#B45309' : '#64748B')}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.algoName}>{algo.name}</Text>
                      <Text style={styles.algoTagline}>{algo.tagline}</Text>
                    </View>
                  </View>

                  {/* Efficiency Metrics Bar */}
                  <View style={styles.efficiencyCard}>
                    <View style={styles.efficiencyRow}>
                      <Text style={styles.efficiencyLabel}>
                        {t('srs.efficiency_label')}:
                      </Text>
                      <View style={styles.starsRow}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={13}
                            color={i < algo.efficiencyStars ? '#D97706' : '#CBD5E1'}
                            fill={i < algo.efficiencyStars ? '#D97706' : 'transparent'}
                          />
                        ))}
                      </View>
                      <Text style={styles.efficiencyPercent}>
                        {algo.efficiencyScore}%
                      </Text>
                    </View>

                    <View style={styles.efficiencyBarBg}>
                      <View
                        style={[
                          styles.efficiencyBarFill,
                          { width: `${algo.efficiencyScore}%` },
                          algo.isDefault && { backgroundColor: '#10B981' },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Description & How it works */}
                  <Text style={styles.algoDescription}>{algo.description}</Text>

                  <View style={styles.metaDetailBox}>
                    <Text style={styles.metaLabel}>{t('srs.how_it_works')}:</Text>
                    <Text style={styles.metaText}>{algo.howItWorks}</Text>
                  </View>

                  <View style={[styles.metaDetailBox, { marginTop: 6 }]}>
                    <Text style={styles.metaLabel}>{t('srs.best_for')}:</Text>
                    <Text style={styles.metaText}>{algo.bestFor}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Seamless Switch Footer Note */}
            <View style={styles.footerNoteCard}>
              <Info size={16} color="#475569" style={{ marginTop: 2 }} />
              <Text style={styles.footerNoteText}>
                {t('srs.seamless_switch')}
              </Text>
            </View>
          </ScrollView>

          {/* Close Action */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.doneBtn}
              onPress={onClose}
            >
              <Text style={styles.doneBtnText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '88%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  scrollArea: {
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingVertical: 16,
    gap: 14,
  },
  algoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  algoCardActive: {
    borderColor: '#D97706',
    backgroundColor: '#FFFEFA',
  },
  algoCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badgeGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.4,
  },
  defaultBadge: {
    backgroundColor: '#ECFDF5',
  },
  defaultBadgeText: {
    color: '#047857',
  },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  selectedPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  selectCtaPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  selectCtaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  algoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  algoIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  algoName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  algoTagline: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600',
    marginTop: 2,
  },
  efficiencyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  efficiencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  efficiencyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  efficiencyPercent: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  efficiencyBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  efficiencyBarFill: {
    height: '100%',
    backgroundColor: '#D97706',
    borderRadius: 3,
  },
  algoDescription: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    marginBottom: 10,
  },
  metaDetailBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 8,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 2,
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  footerNoteCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  footerNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  doneBtn: {
    backgroundColor: '#D97706',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
