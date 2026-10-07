import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Globe,
  Search,
  Check,
  X,
  Download,
  Trash2,
  ArrowLeftRight,
  Languages,
  HardDrive,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  SUPPORTED_LANGUAGES,
  LanguageOption,
  getLanguageByCode,
  getLanguageByName,
  getLanguageFlag,
  formatLanguageCode,
} from '../../locales/languages';
import { changeAppLanguage, getDeviceLanguage } from '../../locales';
import {
  getLanguagePairSettings,
  setLanguagePairSettings,
  getDownloadedLanguages,
  getEnrolledLanguagePairs,
  enrollLanguagePair,
  removeEnrolledLanguagePair,
} from '../../db/vault';
import {
  downloadLanguagePack,
  deleteLanguagePack,
} from '../../db/downloader';
import { DownloadedLanguage, LanguagePairSettings, EnrolledLanguagePair } from '../../types';

import { colors } from '../../theme';

interface LanguageSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onPairChanged?: (settings: LanguagePairSettings) => void;
  initialMode?: 'origin' | 'destination';
}

type SelectionMode = 'origin' | 'destination';
type FilterTab = 'all' | 'downloaded';

export const LanguageSelectorModal: React.FC<LanguageSelectorModalProps> = ({
  visible,
  onClose,
  onPairChanged,
  initialMode = 'destination',
}) => {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [mode, setMode] = useState<SelectionMode>(initialMode);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [pair, setPair] = useState<LanguagePairSettings>(() => {
    const dev = getDeviceLanguage();
    return {
      origin_lang: dev,
      destination_lang: dev === 'en' ? 'es' : 'en',
    };
  });
  const [downloadedLangs, setDownloadedLangs] = useState<DownloadedLanguage[]>([]);
  const [enrolledPairs, setEnrolledPairs] = useState<EnrolledLanguagePair[]>([]);
  const [downloadingCode, setDownloadingCode] = useState<string | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  // Load language settings & downloaded list when modal opens
  useEffect(() => {
    if (visible) {
      if (initialMode) {
        setMode(initialMode);
      }
      loadSettings();
    }
  }, [visible, initialMode]);

  const loadSettings = async () => {
    try {
      const currentPair = await getLanguagePairSettings();
      setPair(currentPair);
      const list = await getDownloadedLanguages();
      setDownloadedLangs(list);
      const enrolled = await getEnrolledLanguagePairs();
      setEnrolledPairs(enrolled);
    } catch (error) {
      console.warn('[LanguageModal] Error loading settings:', error);
    }
  };

  const downloadedCodesSet = useMemo(() => {
    const set = new Set<string>();
    downloadedLangs.forEach((dl) => {
      set.add(dl.code.toLowerCase());
      const opt = getLanguageByName(dl.lang_name);
      if (opt) set.add(opt.code.toLowerCase());
    });
    // English is always available via the core lexicon cards
    set.add('en');
    return set;
  }, [downloadedLangs]);

  const filteredLanguages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = SUPPORTED_LANGUAGES;

    if (filterTab === 'downloaded') {
      list = list.filter((lang) => downloadedCodesSet.has(lang.code.toLowerCase()));
    }

    if (!q) return list;

    return list.filter(
      (lang) =>
        lang.name.toLowerCase().includes(q) ||
        lang.nativeName.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q)
    );
  }, [searchQuery, filterTab, downloadedCodesSet]);

  const handleDownload = async (lang: LanguageOption) => {
    try {
      setDownloadingCode(lang.code);
      await downloadLanguagePack(lang.code);
      const updated = await getDownloadedLanguages();
      setDownloadedLangs(updated);
    } catch (error) {
      Alert.alert(
        t('language.download_error', 'Download Failed'),
        `Could not download language pack for ${lang.name}.`
      );
    } finally {
      setDownloadingCode(null);
    }
  };

  const handleDelete = async (lang: LanguageOption) => {
    if (lang.code === 'en') {
      Alert.alert(
        t('language.cannot_delete', 'Protected Language'),
        'English is the base lexicon and cannot be deleted.'
      );
      return;
    }

    if (lang.code === pair.origin_lang || lang.code === pair.destination_lang) {
      Alert.alert(
        t('language.cannot_delete', 'In-Use Language'),
        `Cannot delete ${lang.name} because it is currently selected as your active ${lang.code === pair.origin_lang ? 'Origin' : 'Study'
        } language.`
      );
      return;
    }

    try {
      setDeletingCode(lang.code);
      await deleteLanguagePack(lang.code);
      const updated = await getDownloadedLanguages();
      setDownloadedLangs(updated);
    } catch (error) {
      Alert.alert(
        t('language.delete_error', 'Delete Failed'),
        `Could not delete ${lang.name}.`
      );
    } finally {
      setDeletingCode(null);
    }
  };

  const handleSelectLanguage = async (lang: LanguageOption) => {
    // 1. Ensure downloaded
    if (!downloadedCodesSet.has(lang.code.toLowerCase())) {
      try {
        setDownloadingCode(lang.code);
        await downloadLanguagePack(lang.code);
        const updated = await getDownloadedLanguages();
        setDownloadedLangs(updated);
      } catch (e) {
        Alert.alert(
          t('language.download_error', 'Download Failed'),
          `Could not download ${lang.name}.`
        );
        setDownloadingCode(null);
        return;
      } finally {
        setDownloadingCode(null);
      }
    }

    // 2. Apply selection
    let updatedPair: LanguagePairSettings;
    if (mode === 'origin') {
      updatedPair = { ...pair, origin_lang: lang.code };
      await changeAppLanguage(lang.code);
    } else {
      updatedPair = { ...pair, destination_lang: lang.code };
    }

    setPair(updatedPair);
    await setLanguagePairSettings(updatedPair);
    await enrollLanguagePair(updatedPair);
    const updated = await getEnrolledLanguagePairs();
    setEnrolledPairs(updated);

    if (onPairChanged) {
      onPairChanged(updatedPair);
    }

    onClose();
  };

  const handleSelectEnrolledPair = async (p: EnrolledLanguagePair) => {
    const newPair: LanguagePairSettings = {
      destination_lang: p.destination_lang,
      origin_lang: p.origin_lang,
    };
    setPair(newPair);
    await setLanguagePairSettings(newPair);
    if (onPairChanged) {
      onPairChanged(newPair);
    }
    onClose();
  };

  const handleSwapPair = async () => {
    const swapped: LanguagePairSettings = {
      origin_lang: pair.destination_lang,
      destination_lang: pair.origin_lang,
    };
    setPair(swapped);
    await changeAppLanguage(swapped.origin_lang);
    await setLanguagePairSettings(swapped);
    if (onPairChanged) {
      onPairChanged(swapped);
    }
  };

  const originOption = getLanguageByCode(pair.origin_lang) || {
    code: pair.origin_lang,
    name: 'English',
    nativeName: 'English',
  };
  const destinationOption = getLanguageByCode(pair.destination_lang) || {
    code: pair.destination_lang,
    name: 'Spanish',
    nativeName: 'Español',
  };

  const handleDeleteCallback = useCallback((lang: LanguageOption) => {
    handleDelete(lang);
  }, [handleDelete]);

  const handleSelectCallback = useCallback((lang: LanguageOption) => {
    handleSelectLanguage(lang);
  }, [handleSelectLanguage]);

  const handleDownloadCallback = useCallback((lang: LanguageOption) => {
    handleDownload(lang);
  }, [handleDownload]);

  const renderLanguageItem = useCallback(({ item }: { item: LanguageOption }) => {
    const isDownloaded = downloadedCodesSet.has(item.code.toLowerCase());
    const isOrigin = pair.origin_lang === item.code;
    const isDest = pair.destination_lang === item.code;
    const isSelectedInCurrentMode =
      (mode === 'origin' && isOrigin) ||
      (mode === 'destination' && isDest);
    const isDownloading = downloadingCode === item.code;
    const isDeleting = deletingCode === item.code;

    return (
      <LanguageRowItem
        item={item}
        isDownloaded={isDownloaded}
        isSelectedInCurrentMode={isSelectedInCurrentMode}
        isOrigin={isOrigin}
        isDest={isDest}
        isDownloading={isDownloading}
        isDeleting={isDeleting}
        onSelectLanguage={handleSelectCallback}
        onDelete={handleDeleteCallback}
        onDownload={handleDownloadCallback}
      />
    );
  }, [
    downloadedCodesSet,
    pair.origin_lang,
    pair.destination_lang,
    mode,
    downloadingCode,
    deletingCode,
    handleSelectCallback,
    handleDeleteCallback,
    handleDownloadCallback,
  ]);

  const languageKeyExtractor = useCallback((item: LanguageOption) => item.code, []);

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
                <Globe size={20} color={colors.primary[900]} />
              </View>
              <View>
                <Text style={styles.title}>
                  {t('language.title', 'Language Fortress')}
                </Text>
                <Text style={styles.subtitle}>
                  123 Languages
                </Text>
              </View>
            </View>

            <TouchableOpacity
              testID="modal-close-btn"
              style={styles.closeBtn}
              onPress={onClose}
            >
              <X size={20} color={colors.primary[900]} />
            </TouchableOpacity>
          </View>

          {/* Active Pair Banner */}
          <View style={styles.pairBanner}>
            <TouchableOpacity
              style={[
                styles.pairHalf,
                mode === 'origin' && styles.pairHalfActive,
              ]}
              onPress={() => setMode('origin')}
              activeOpacity={0.8}
            >
              <Text style={styles.pairHalfLabel}>
                {t('language.origin_label', 'Native / App')}
              </Text>
              <View style={styles.pairFlagCodeRow}>
                <Text style={styles.pairFlagEmoji}>{getLanguageFlag(originOption.code)}</Text>
                <Text style={styles.pairHalfCodeOnly}>
                  {formatLanguageCode(originOption.code)}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              testID="swap-lang-btn"
              style={styles.swapBtn}
              onPress={handleSwapPair}
              activeOpacity={0.7}
            >
              <ArrowLeftRight size={16} color={colors.primary[900]} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.pairHalf,
                mode === 'destination' && styles.pairHalfActive,
              ]}
              onPress={() => setMode('destination')}
              activeOpacity={0.8}
            >
              <Text style={styles.pairHalfLabel}>
                {t('language.destination_label', 'I am learning')}
              </Text>
              <View style={styles.pairFlagCodeRow}>
                <Text style={styles.pairFlagEmoji}>{getLanguageFlag(destinationOption.code)}</Text>
                <Text style={styles.pairHalfCodeOnly}>
                  {formatLanguageCode(destinationOption.code)}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Enrolled Language Pairs Carousel */}
          {enrolledPairs.length > 0 && (
            <View style={styles.enrolledSection} testID="enrolled-languages-section">
              <View style={styles.enrolledHeaderRow}>
                <Text style={styles.enrolledSectionTitle}>
                  {t('language.enrolled_title', 'Your Learning Languages')} ({enrolledPairs.length})
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.enrolledScroll}
              >
                {enrolledPairs.map((ep) => {
                  const isActive =
                    ep.destination_lang.toLowerCase() === pair.destination_lang.toLowerCase() &&
                    ep.origin_lang.toLowerCase() === pair.origin_lang.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={ep.id}
                      testID={`enrolled-card-${ep.destination_lang}`}
                      style={[
                        styles.enrolledCard,
                        isActive && styles.enrolledCardActive,
                      ]}
                      onPress={() => handleSelectEnrolledPair(ep)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.enrolledTopRow}>
                        <View style={styles.enrolledFlagCodeRow}>
                          <Text style={styles.enrolledFlagEmoji}>{getLanguageFlag(ep.destination_lang)}</Text>
                          <Text style={styles.enrolledLangName} numberOfLines={1}>
                            {formatLanguageCode(ep.destination_lang)}
                          </Text>
                        </View>
                        {isActive && (
                          <View style={styles.activePill}>
                            <Check size={10} color={colors.neutral[0]} />
                            <Text style={styles.activePillText}>Active</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.enrolledSubtext} numberOfLines={1} ellipsizeMode="tail">
                        {getLanguageFlag(ep.destination_lang)} {formatLanguageCode(ep.destination_lang)} ➔ {getLanguageFlag(ep.origin_lang)} {formatLanguageCode(ep.origin_lang)}
                      </Text>
                      <View style={styles.enrolledStatsRow}>
                        <Text style={styles.enrolledStatBadge}>
                          {ep.progress.totalCards} cards
                        </Text>
                        <Text
                          style={[
                            styles.enrolledStatBadge,
                            ep.progress.dueCards > 0 && styles.enrolledStatDue,
                          ]}
                        >
                          {ep.progress.dueCards} due
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Mode Selector Notice */}
          <View style={styles.modeNoticeBar}>
            <Languages size={14} color={colors.primary[700]} />
            <Text style={styles.modeNoticeText}>
              {mode === 'origin'
                ? t('language.selecting_origin', 'Configuring App Interface & Explanation Language')
                : t('language.selecting_dest', 'Select the language you want to learn')}
            </Text>
          </View>

          {/* Filter Tabs: All vs Downloaded */}
          <View style={styles.filterTabBar}>
            <TouchableOpacity
              style={[
                styles.filterTab,
                filterTab === 'all' && styles.filterTabActive,
              ]}
              onPress={() => setFilterTab('all')}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filterTab === 'all' && styles.filterTabTextActive,
                ]}
              >
                All Languages (123)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterTab,
                filterTab === 'downloaded' && styles.filterTabActive,
              ]}
              onPress={() => setFilterTab('downloaded')}
            >
              <HardDrive size={13} color={filterTab === 'downloaded' ? colors.primary[900] : colors.neutral[500]} />
              <Text
                style={[
                  styles.filterTabText,
                  filterTab === 'downloaded' && styles.filterTabTextActive,
                ]}
              >
                Downloaded ({downloadedCodesSet.size})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search Filter Box */}
          <View style={styles.searchBox}>
            <Search size={18} color={colors.neutral[400]} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('language.search_placeholder', 'Search by language, native name or code...')}
              placeholderTextColor={colors.neutral[400]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={colors.neutral[400]} />
              </TouchableOpacity>
            )}
          </View>

          {/* 123 Languages List */}
          <FlatList
            data={filteredLanguages}
            keyExtractor={languageKeyExtractor}
            style={styles.langFlatList}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={11}
            removeClippedSubviews={false}
            renderItem={renderLanguageItem}
          />
        </View>
      </View>
    </Modal>
  );
};

interface LanguageRowItemProps {
  item: LanguageOption;
  isDownloaded: boolean;
  isSelectedInCurrentMode: boolean;
  isOrigin: boolean;
  isDest: boolean;
  isDownloading: boolean;
  isDeleting: boolean;
  onSelectLanguage: (item: LanguageOption) => void;
  onDelete: (item: LanguageOption) => void;
  onDownload: (item: LanguageOption) => void;
}

const LanguageRowItem = React.memo<LanguageRowItemProps>(({
  item,
  isDownloaded,
  isSelectedInCurrentMode,
  isOrigin,
  isDest,
  isDownloading,
  isDeleting,
  onSelectLanguage,
  onDelete,
  onDownload,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onSelectLanguage(item)}
      style={[
        styles.langRow,
        isSelectedInCurrentMode && styles.langRowSelected,
      ]}
    >
      <View style={styles.langRowLeft}>
        <Text style={styles.listRowFlag}>{item.flag || getLanguageFlag(item.code)}</Text>
        <View style={styles.langNames}>
          <View style={styles.nameRow}>
            <Text
              style={[
                styles.langCodeMain,
                isSelectedInCurrentMode && styles.langCodeMainSelected,
              ]}
              numberOfLines={1}
            >
              {formatLanguageCode(item.code)}
            </Text>

            {isOrigin && (
              <View style={styles.originTag}>
                <Text style={styles.originTagText}>App (Origin)</Text>
              </View>
            )}
            {isDest && (
              <View style={styles.destTag}>
                <Text style={styles.destTagText}>Study Target</Text>
              </View>
            )}
          </View>

          {item.nativeName ? (
            <Text
              style={[
                styles.langNativeScript,
                isSelectedInCurrentMode && styles.langNativeScriptSelected,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.nativeName}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Actions / Status */}
      <View style={styles.rowActions}>
        {isDownloading ? (
          <ActivityIndicator size="small" color={colors.primary[600]} />
        ) : isDeleting ? (
          <ActivityIndicator size="small" color={colors.danger[600]} />
        ) : isDownloaded ? (
          <View style={styles.downloadedGroup}>
            <View style={styles.downloadedBadge}>
              <Check size={12} color={colors.success[600]} />
              <Text style={styles.downloadedBadgeText}>Saved</Text>
            </View>

            {!isOrigin && !isDest && item.code !== 'en' && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => onDelete(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Trash2 size={15} color={colors.neutral[400]} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.downloadBtn}
            onPress={() => onDownload(item)}
          >
            <Download size={13} color={colors.primary[900]} />
            <Text style={styles.downloadBtnText}>Get</Text>
          </TouchableOpacity>
        )}

        {isSelectedInCurrentMode && (
          <View style={styles.checkCircle}>
            <Check size={13} color={colors.neutral[0]} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.primary[50],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 2,
    borderColor: colors.primary[600],
    borderBottomWidth: 0,
    height: '93%',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[200],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary[200],
    borderWidth: 1.5,
    borderColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'serif',
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary[900],
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    color: colors.primary[800],
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  pairBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    padding: 8,
    marginTop: 8,
    gap: 6,
  },
  pairHalf: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.neutral[50],
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pairHalfActive: {
    backgroundColor: colors.primary[100],
    borderColor: colors.primary[600],
  },
  pairHalfLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary[800],
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  pairHalfName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[800],
  },
  pairHalfCode: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 1,
  },
  swapBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[100],
    borderWidth: 1,
    borderColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeNoticeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  modeNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary[800],
  },
  filterTabBar: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: 5,
  },
  filterTabActive: {
    backgroundColor: colors.primary[100],
    borderColor: colors.primary[600],
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  filterTabTextActive: {
    color: colors.primary[900],
    fontWeight: '800',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    paddingHorizontal: 12,
    height: 40,
    marginTop: 8,
    marginBottom: 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.neutral[800],
  },
  langFlatList: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 4,
    paddingBottom: 36,
    gap: 6,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral[0],
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 56,
  },
  langRowSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
    borderWidth: 1.5,
  },
  langNames: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
    minWidth: 0,
  },
  nativeName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  nativeNameSelected: {
    color: colors.primary[900],
  },
  originTag: {
    backgroundColor: colors.primary[50],
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: colors.primary[200],
    flexShrink: 0,
  },
  originTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary[700],
  },
  destTag: {
    backgroundColor: colors.success[50],
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: colors.success[200],
    flexShrink: 0,
  },
  destTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.success[600],
  },
  englishName: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  downloadedGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.success[50],
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  downloadedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success[600],
  },
  deleteBtn: {
    padding: 4,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary[600],
  },
  downloadBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary[900],
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  enrolledSection: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: colors.primary[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[200],
  },
  enrolledHeaderRow: {
    marginBottom: 8,
  },
  enrolledSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary[800],
    letterSpacing: 0.3,
  },
  enrolledScroll: {
    gap: 10,
  },
  enrolledCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    minWidth: 155,
  },
  enrolledCardActive: {
    borderColor: colors.primary[700],
    backgroundColor: colors.primary[100],
    borderWidth: 2,
  },
  enrolledTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  enrolledLangName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[800],
    flexShrink: 1,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.success[600],
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.neutral[0],
  },
  enrolledSubtext: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[500],
    marginTop: 2,
  },
  enrolledStatsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  enrolledStatBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[600],
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  enrolledStatDue: {
    color: colors.primary[700],
    backgroundColor: colors.primary[200],
  },
  pairFlagCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    minWidth: 0,
  },
  pairFlagEmoji: {
    fontSize: 18,
  },
  pairHalfCodeOnly: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.primary[900],
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  enrolledFlagCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  enrolledFlagEmoji: {
    fontSize: 14,
  },
  langRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  listRowFlag: {
    fontSize: 22,
  },
  langCodeMain: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.neutral[800],
    letterSpacing: 0.5,
  },
  langCodeMainSelected: {
    color: colors.primary[700],
  },
  langNativeScript: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[500],
    marginTop: 2,
  },
  langNativeScriptSelected: {
    color: colors.primary[800],
  },
});

