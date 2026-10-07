import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { X, Check, Shield, Zap, Sparkles, RefreshCw, Layers } from 'lucide-react-native';
import { USER_PROFILES, UserProfilePreset, seedMockUserProfile } from '../../db/mockProfiles';

import { colors } from '../../theme';

interface MockProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onProfileApplied?: (preset: UserProfilePreset) => Promise<void> | void;
  targetLang?: string;
  originLang?: string;
}

export const MockProfileModal: React.FC<MockProfileModalProps> = ({
  visible,
  onClose,
  onProfileApplied,
  targetLang = 'es',
  originLang = 'en',
}) => {
  const [loadingPreset, setLoadingPreset] = useState<UserProfilePreset | null>(null);
  const [activePreset, setActivePreset] = useState<UserProfilePreset | null>(null);

  const handleSelectProfile = async (preset: UserProfilePreset) => {
    setLoadingPreset(preset);
    try {
      await seedMockUserProfile(preset, undefined, { targetLang, originLang });
      setActivePreset(preset);
      if (onProfileApplied) {
        await onProfileApplied(preset);
      }
      onClose();
    } catch (error) {
      console.error('[MockProfileModal] Failed to seed mock profile:', error);
    } finally {
      setLoadingPreset(null);
    }
  };

  const presets: UserProfilePreset[] = ['beginner', 'intermediate', 'advanced', 'clean'];

  const getProfileIcon = (preset: UserProfilePreset) => {
    switch (preset) {
      case 'beginner':
        return <Shield size={20} color={colors.primary[700]} />;
      case 'intermediate':
        return <Zap size={20} color={colors.primary[600]} />;
      case 'advanced':
        return <Sparkles size={20} color={colors.success[600]} />;
      case 'clean':
        return <RefreshCw size={20} color={colors.neutral[500]} />;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconContainer}>
                <Layers size={22} color={colors.neutral[800]} />
              </View>
              <View>
                <Text style={styles.title}>Testing Profiles</Text>
                <Text style={styles.subtitle}>Select a mock user profile to seed realistic test data</Text>
              </View>
            </View>
            <TouchableOpacity
              testID="modal-close-btn"
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <X size={20} color={colors.neutral[500]} />
            </TouchableOpacity>
          </View>

          {/* Profile Cards List */}
          <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
            {presets.map((preset) => {
              const profile = USER_PROFILES[preset];
              const isLoading = loadingPreset === preset;
              const isSelected = activePreset === preset;

              return (
                <TouchableOpacity
                  key={preset}
                  testID={`profile-card-${preset}`}
                  style={[styles.profileCard, isSelected && styles.profileCardActive]}
                  onPress={() => handleSelectProfile(preset)}
                  disabled={loadingPreset !== null}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                      <View style={styles.profileIconWrap}>{getProfileIcon(preset)}</View>
                      <View>
                        <Text style={styles.profileTitle}>{profile.title}</Text>
                        <Text style={styles.profileBadge}>{profile.badge}</Text>
                      </View>
                    </View>
                    {isLoading ? (
                      <ActivityIndicator size="small" color={colors.primary[700]} />
                    ) : isSelected ? (
                      <View style={styles.activeCheck}>
                        <Check size={14} color={colors.neutral[0]} />
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.profileDesc}>{profile.description}</Text>

                  {preset !== 'clean' && (
                    <View style={styles.statsRow}>
                      <View style={styles.statBox}>
                        <Text style={styles.statNum}>{profile.cardCount}</Text>
                        <Text style={styles.statLabel}>Words</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statNum}>{profile.masteredCount}</Text>
                        <Text style={styles.statLabel}>Mastered</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statNum}>{profile.dueCount}</Text>
                        <Text style={styles.statLabel}>Due Now</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statNum}>{profile.streakDays}d</Text>
                        <Text style={styles.statLabel}>Streak</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
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
  container: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  subtitle: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollList: {
    padding: 16,
    gap: 12,
  },
  profileCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    padding: 16,
  },
  profileCardActive: {
    borderColor: colors.primary[700],
    backgroundColor: colors.primary[50],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  profileTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  profileBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[500],
    marginTop: 1,
  },
  activeCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDesc: {
    fontSize: 13,
    color: colors.neutral[600],
    lineHeight: 18,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral[0],
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  statBox: {
    alignItems: 'center',
  },
  statNum: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.neutral[500],
    marginTop: 2,
    textTransform: 'uppercase',
  },
});
