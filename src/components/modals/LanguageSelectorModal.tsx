import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
} from 'react-native';
import { Globe, Search, Check, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  SUPPORTED_LANGUAGES,
  LanguageOption,
} from '../../locales/languages';
import { changeAppLanguage } from '../../locales';

interface LanguageSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onLanguageChanged?: (code: string) => void;
}

export const LanguageSelectorModal: React.FC<LanguageSelectorModalProps> = ({
  visible,
  onClose,
  onLanguageChanged,
}) => {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const currentLang = i18n.language || 'en';

  const filteredLanguages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SUPPORTED_LANGUAGES;
    return SUPPORTED_LANGUAGES.filter(
      (lang) =>
        lang.name.toLowerCase().includes(q) ||
        lang.nativeName.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleSelectLanguage = async (code: string) => {
    await changeAppLanguage(code);
    if (onLanguageChanged) {
      onLanguageChanged(code);
    }
    onClose();
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
                <Globe size={20} color="#78350F" />
              </View>
              <View>
                <Text style={styles.title}>{t('language.title')}</Text>
                <Text style={styles.subtitle}>
                  Select from 123 global languages
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color="#78350F" />
            </TouchableOpacity>
          </View>

          {/* Search Filter Box */}
          <View style={styles.searchBox}>
            <Search size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder={t('language.search_placeholder')}
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* 50 Languages List */}
          <FlatList
            data={filteredLanguages}
            keyExtractor={(item) => item.code}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected =
                currentLang === item.code ||
                currentLang.startsWith(`${item.code}-`);

              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleSelectLanguage(item.code)}
                  style={[
                    styles.langRow,
                    isSelected && styles.langRowSelected,
                  ]}
                >
                  <View style={styles.langNames}>
                    <Text
                      style={[
                        styles.nativeName,
                        isSelected && styles.nativeNameSelected,
                      ]}
                    >
                      {item.nativeName}
                    </Text>
                    <Text style={styles.englishName}>
                      {item.name} ({item.code.toUpperCase()})
                    </Text>
                  </View>

                  {isSelected ? (
                    <View style={styles.checkCircle}>
                      <Check size={14} color="#FFFFFF" />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FEFCE8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 2,
    borderColor: '#D97706',
    borderBottomWidth: 0,
    maxHeight: '80%',
    minHeight: '60%',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
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
    backgroundColor: '#FDE68A',
    borderWidth: 1.5,
    borderColor: '#D97706',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'serif',
    fontSize: 16,
    fontWeight: '900',
    color: '#78350F',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 42,
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
  },
  listContent: {
    paddingVertical: 6,
    gap: 6,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  langRowSelected: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1.5,
  },
  langNames: {
    flex: 1,
  },
  nativeName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  nativeNameSelected: {
    color: '#78350F',
  },
  englishName: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
