import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, Search, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { LexMascot } from '../../components/mascot/Mascots';
import { ChunkyButton, ButtonColor } from '../../components/ui/ChunkyButton';
import { CEFRLevel, LanguagePairSettings, MascotMood } from '../../types';
import { completeOnboarding, isLanguageDownloaded } from '../../db/vault';
import { downloadLanguagePack } from '../../db/downloader';
import { LanguageOption, SUPPORTED_LANGUAGES, resolveLanguageCode } from '../../locales/languages';
import { colors, levelColorsFor, levelLabel, radii, spacing, toLevel } from '../../theme';

const MAX_TARGETS = 5;
const LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const LEVEL_COPY: Record<CEFRLevel, { title: string; detail: string }> = {
  A1: { title: 'Beginner', detail: 'I know a few words, or none yet.' },
  A2: { title: 'Elementary', detail: 'I can handle simple, everyday phrases.' },
  B1: { title: 'Intermediate', detail: 'I get by when traveling and can chat about familiar topics.' },
  B2: { title: 'Upper intermediate', detail: 'I follow most conversations, shows and articles.' },
  C1: { title: 'Advanced', detail: 'I express myself fluently, even on complex topics.' },
  C2: { title: 'Proficient', detail: 'I understand virtually everything I hear or read.' },
};

const GRADES: { key: string; label: string; color: ButtonColor; example: string; when: string; effect: string }[] = [
  {
    key: 'again',
    label: 'Again',
    color: 'danger',
    example: '10m',
    when: "You didn't remember it, or you got it wrong.",
    effect: 'The card comes back in a few minutes so you can relearn it.',
  },
  {
    key: 'hard',
    label: 'Hard',
    color: 'warning',
    example: '1d',
    when: 'You got it, but it took real effort or you were unsure.',
    effect: 'You see it again sooner than usual.',
  },
  {
    key: 'good',
    label: 'Good',
    color: 'success',
    example: '4d',
    when: 'You remembered it after a moment of thought.',
    effect: 'The normal answer. The gap before the next review keeps growing.',
  },
  {
    key: 'easy',
    label: 'Easy',
    color: 'primary',
    example: '12d',
    when: 'You knew it instantly, with no effort at all.',
    effect: 'A big jump ahead. Save it for words that are truly effortless.',
  },
];

type Step = 0 | 1 | 2 | 3;
const STEP_COUNT = 4;

const languageByCode = (code: string) => SUPPORTED_LANGUAGES.find((l) => l.code === code);

/** Most-studied languages, listed first so the common picks need no scrolling or search. */
export const POPULAR_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt-BR', 'ja', 'ko', 'zh-CN'];

const POPULAR_RANK = new Map(POPULAR_LANGUAGES.map((code, i) => [code, i]));

/** Popular languages first (in POPULAR_LANGUAGES order), then the rest as listed. */
const ORDERED_LANGUAGES = [...SUPPORTED_LANGUAGES].sort(
  (a, b) => (POPULAR_RANK.get(a.code) ?? Infinity) - (POPULAR_RANK.get(b.code) ?? Infinity)
);

/** A supported language code for the given code or name, or English when it isn't supported. */
export function defaultOrigin(codeOrName: string | undefined): string {
  const code = resolveLanguageCode(codeOrName || 'en');
  return languageByCode(code) ? code : 'en';
}

/** What a speaker of `origin` most likely wants to learn: English, or Spanish for English speakers. */
export function defaultTargetFor(origin: string): string {
  return origin === 'en' ? 'es' : 'en';
}

/**
 * Starting selection for "What do you want to learn?": the pair the app already
 * set up when it is valid for this origin, else the default for the origin.
 */
export function defaultTargets(origin: string, suggested?: string): string[] {
  const code = suggested ? resolveLanguageCode(suggested) : '';
  if (code && code !== origin && languageByCode(code)) return [code];
  return [defaultTargetFor(origin)];
}

interface LanguageListProps {
  selected: string[];
  exclude?: string;
  onToggle: (lang: LanguageOption) => void;
  testIDPrefix: string;
}

const ROW_HEIGHT = 56;

const LanguageList: React.FC<LanguageListProps> = ({ selected, exclude, onToggle, testIDPrefix }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ORDERED_LANGUAGES.filter(
      (l) =>
        l.code !== exclude &&
        (!q ||
          l.name.toLowerCase().includes(q) ||
          l.nativeName.toLowerCase().includes(q) ||
          l.code.toLowerCase() === q)
    );
  }, [query, exclude]);

  const renderItem = useCallback(
    ({ item }: { item: LanguageOption }) => {
      const isSelected = selected.includes(item.code);
      return (
        <Pressable
          style={({ pressed }) => [
            styles.langRow,
            isSelected && styles.langRowSelected,
            pressed && !isSelected && styles.langRowPressed,
          ]}
          onPress={() => onToggle(item)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSelected }}
          testID={`${testIDPrefix}-${item.code}`}
        >
          <Text style={styles.langFlag}>{item.flag}</Text>
          <View style={styles.langNames}>
            <Text style={styles.langNative} numberOfLines={1}>
              {item.nativeName}
            </Text>
            {item.nativeName !== item.name && (
              <Text style={styles.langEnglish} numberOfLines={1}>
                {item.name}
              </Text>
            )}
          </View>
          <View style={[styles.langCheck, isSelected && styles.langCheckOn]}>
            {isSelected && <Check size={14} color={colors.neutral[0]} strokeWidth={3} />}
          </View>
        </Pressable>
      );
    },
    [selected, onToggle, testIDPrefix]
  );

  return (
    <View style={styles.langListWrap}>
      <View style={styles.searchBox}>
        <Search size={16} color={colors.neutral[500]} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('onboarding.search_languages', { defaultValue: 'Search languages' })}
          placeholderTextColor={colors.textSubtle}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          testID={`${testIDPrefix}-search`}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
            <X size={16} color={colors.neutral[500]} />
          </Pressable>
        )}
      </View>
      <FlatList
        data={data}
        keyExtractor={(l) => l.code}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        style={styles.langList}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {t('onboarding.no_language_match', { defaultValue: 'No language matches that search.' })}
          </Text>
        }
      />
    </View>
  );
};

export interface OnboardingScreenProps {
  /** Pre-selected native language (usually the device language). */
  initialOrigin: string;
  /** Pre-selected language to learn, e.g. the pair the app set up on first launch. */
  initialTarget?: string;
  onComplete: (pair: LanguagePairSettings) => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  initialOrigin,
  initialTarget,
  onComplete,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(0);
  const [origin, setOrigin] = useState(() => defaultOrigin(initialOrigin));
  const [targets, setTargets] = useState<string[]>(() => defaultTargets(defaultOrigin(initialOrigin), initialTarget));
  const [levels, setLevels] = useState<Record<string, CEFRLevel>>({});
  const [saving, setSaving] = useState(false);
  const [savingMessage, setSavingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const toggleTarget = useCallback((lang: LanguageOption) => {
    setTargets((prev) => {
      if (prev.includes(lang.code)) return prev.filter((c) => c !== lang.code);
      if (prev.length >= MAX_TARGETS) return prev;
      return [...prev, lang.code];
    });
  }, []);

  const chooseOrigin = useCallback((lang: LanguageOption) => {
    setOrigin(lang.code);
    // Never leave the next step empty: refill with the default for the new native language.
    setTargets((prev) => {
      const kept = prev.filter((c) => c !== lang.code);
      return kept.length > 0 ? kept : [defaultTargetFor(lang.code)];
    });
  }, []);

  const canContinue = step !== 1 || targets.length > 0;

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const code of [origin, ...targets]) {
        if (!(await isLanguageDownloaded(code))) {
          const name = languageByCode(code)?.name ?? code;
          setSavingMessage(t('onboarding.preparing_language', { name, defaultValue: 'Preparing {{name}}…' }));
          await downloadLanguagePack(code);
        }
      }
      setSavingMessage(t('onboarding.saving', { defaultValue: 'Setting up your lab…' }));
      const pair = await completeOnboarding({
        origin_lang: origin,
        targets: targets.map((code) => ({ destination_lang: code, level: levels[code] || 'A1' })),
      });
      onComplete(pair);
    } catch (e) {
      console.warn('[Onboarding] Setup failed:', e);
      setError(
        t('onboarding.setup_failed', {
          defaultValue: "We couldn't set up your languages. Check your storage space and try again.",
        })
      );
      setSaving(false);
    }
  };

  const next = () => {
    if (step < STEP_COUNT - 1) setStep((s) => (s + 1) as Step);
    else finish();
  };
  const back = () => setStep((s) => (s > 0 ? ((s - 1) as Step) : s));

  const mood: MascotMood = step === 0 ? 'happy' : step === 3 ? 'thinking' : 'idle';
  const originLang = languageByCode(origin);

  const header = [
    {
      title: t('onboarding.welcome_title', { defaultValue: "Hi, I'm Lex!" }),
      body: t('onboarding.welcome_body', {
        defaultValue: "Let's set up your language lab. First, which language do you speak best?",
      }),
    },
    {
      title: t('onboarding.targets_title', { defaultValue: 'What do you want to learn?' }),
      body: t('onboarding.targets_body', {
        max: MAX_TARGETS,
        defaultValue:
          'Pick up to {{max}} languages. Each one becomes a language pair you can switch between anytime. The first one is where we start.',
      }),
    },
    {
      title: t('onboarding.levels_title', { defaultValue: 'How well do you know them?' }),
      body: t('onboarding.levels_body', {
        defaultValue:
          "Levels go from 1 (just starting) to 6 (near-native). We'll suggest new words around your level, and you can study any level whenever you like.",
      }),
    },
    {
      title: t('onboarding.grading_title', { defaultValue: 'How to grade yourself' }),
      body: t('onboarding.grading_body', {
        defaultValue:
          "When a card appears, try to recall the meaning, then tap to flip it. Tell me how it went, and the scheduler picks the best day to show it again: right before you'd forget.",
      }),
    },
  ][step];

  return (
    <View style={styles.container}>
      {/* Progress */}
      <View style={styles.progressRow} accessibilityLabel={`Step ${step + 1} of ${STEP_COUNT}`}>
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <View key={i} style={[styles.progressSegment, i <= step && styles.progressSegmentOn]} />
        ))}
      </View>

      {/* Lex + step heading */}
      <View style={styles.heroRow}>
        <LexMascot mood={mood} size={step === 0 ? 96 : 72} />
        <View style={styles.heroText}>
          <Text style={styles.title}>{header.title}</Text>
          <Text style={styles.body}>{header.body}</Text>
        </View>
      </View>

      {/* Step content */}
      <View style={styles.content}>
        {step === 0 && (
          <LanguageList selected={[origin]} onToggle={chooseOrigin} testIDPrefix="onboarding-origin" />
        )}

        {step === 1 && (
          <>
            {targets.length > 0 && (
              <View style={styles.chipRow}>
                {targets.map((code, i) => {
                  const lang = languageByCode(code);
                  return (
                    <Pressable
                      key={code}
                      style={[styles.chip, i === 0 && styles.chipFirst]}
                      onPress={() => lang && toggleTarget(lang)}
                      accessibilityLabel={`Remove ${lang?.name ?? code}`}
                    >
                      <Text style={styles.chipText}>
                        {lang?.flag} {lang?.name}
                      </Text>
                      <X size={12} color={i === 0 ? colors.neutral[0] : colors.primary[800]} />
                    </Pressable>
                  );
                })}
              </View>
            )}
            <LanguageList
              selected={targets}
              exclude={origin}
              onToggle={toggleTarget}
              testIDPrefix="onboarding-target"
            />
          </>
        )}

        {step === 2 && (
          <ScrollView contentContainerStyle={styles.levelsScroll} showsVerticalScrollIndicator={false}>
            {targets.map((code) => {
              const lang = languageByCode(code);
              const level = levels[code] || 'A1';
              return (
                <View key={code} style={styles.levelCard}>
                  <Text style={styles.levelLang}>
                    {lang?.flag} {lang?.name}
                    <Text style={styles.levelPair}>
                      {'  '}
                      {t('onboarding.from_language', {
                        name: originLang?.name ?? origin,
                        defaultValue: 'from {{name}}',
                      })}
                    </Text>
                  </Text>
                  <View style={styles.levelChips}>
                    {LEVELS.map((l) => {
                      const on = l === level;
                      const c = levelColorsFor(l);
                      return (
                        <Pressable
                          key={l}
                          onPress={() => setLevels((prev) => ({ ...prev, [code]: l }))}
                          style={[
                            styles.levelChip,
                            on && { backgroundColor: c.solid, borderColor: c.solidBorder },
                          ]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={`${levelLabel(l)}, ${LEVEL_COPY[l].title}`}
                          testID={`onboarding-level-${code}-${l}`}
                        >
                          <Text style={[styles.levelChipText, on && { color: c.onSolid }]}>{toLevel(l)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.levelTitle}>
                    {levelLabel(level)} ·{' '}
                    {t(`onboarding.level_${level}_title`, { defaultValue: LEVEL_COPY[level].title })}
                  </Text>
                  <Text style={styles.levelDetail}>
                    {t(`onboarding.level_${level}_detail`, { defaultValue: LEVEL_COPY[level].detail })}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        {step === 3 && (
          <ScrollView contentContainerStyle={styles.gradesScroll} showsVerticalScrollIndicator={false}>
            {GRADES.map((g) => (
              <View key={g.key} style={styles.gradeRow}>
                <View pointerEvents="none" style={styles.gradeButtonWrap}>
                  <ChunkyButton
                    title={t(`onboarding.grade_${g.key}`, { defaultValue: g.label })}
                    subtitle={g.example}
                    color={g.color}
                    onPress={() => {}}
                    style={styles.gradeButton}
                    textStyle={styles.gradeButtonText}
                  />
                </View>
                <View style={styles.gradeText}>
                  <Text style={styles.gradeWhen}>
                    {t(`onboarding.grade_${g.key}_when`, { defaultValue: g.when })}
                  </Text>
                  <Text style={styles.gradeEffect}>
                    {t(`onboarding.grade_${g.key}_effect`, { defaultValue: g.effect })}
                  </Text>
                </View>
              </View>
            ))}

            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>{t('onboarding.tips_title', { defaultValue: 'Tips' })}</Text>
              <Text style={styles.tip}>
                {t('onboarding.tip_honest', {
                  defaultValue:
                    'Be honest. Tapping Good when it was really Hard makes the gaps too long, and you start forgetting.',
                })}
              </Text>
              <Text style={styles.tip}>
                {t('onboarding.tip_good', {
                  defaultValue: 'Most of your answers should be Good. Use Easy only when there was zero hesitation.',
                })}
              </Text>
              <Text style={styles.tip}>
                {t('onboarding.tip_intervals', {
                  defaultValue:
                    'The small time under each button (10m, 1d, 4d…) is when you will see that card next if you pick it.',
                })}
              </Text>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {error && <Text style={styles.error}>{error}</Text>}
        {saving ? (
          <View style={styles.savingRow}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.savingText}>{savingMessage}</Text>
          </View>
        ) : (
          <View style={styles.footerButtons}>
            {step > 0 && (
              <ChunkyButton
                title={t('onboarding.back', { defaultValue: 'Back' })}
                color="secondary"
                onPress={back}
                style={styles.backButton}
                testID="onboarding-back"
              />
            )}
            <ChunkyButton
              title={
                step === STEP_COUNT - 1
                  ? t('onboarding.start', { defaultValue: 'Start learning' })
                  : t('onboarding.next', { defaultValue: 'Continue' })
              }
              subtitle={
                step === 1 && targets.length === 0
                  ? t('onboarding.pick_one', { defaultValue: 'Pick at least one language' })
                  : undefined
              }
              color="primary"
              onPress={next}
              disabled={!canContinue}
              style={styles.nextButton}
              testID="onboarding-next"
            />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  progressSegment: {
    flex: 1,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primary[100],
  },
  progressSegmentOn: {
    backgroundColor: colors.brand,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  heroText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
    color: colors.textStrong,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
  },
  langListWrap: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  langList: {
    flex: 1,
  },
  langRow: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  langRowSelected: {
    backgroundColor: colors.primary[50],
  },
  langRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  langFlag: {
    fontSize: 22,
  },
  langNames: {
    flex: 1,
  },
  langNative: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  langEnglish: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  langCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langCheckOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  emptyText: {
    padding: spacing.lg,
    textAlign: 'center',
    color: colors.textMuted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primary[100],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  chipFirst: {
    backgroundColor: colors.brand,
    borderColor: colors.primary[700],
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary[800],
  },
  levelsScroll: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  levelCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.border,
    borderBottomWidth: 4,
    borderBottomColor: colors.borderStrong,
    padding: spacing.lg,
  },
  levelLang: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textStrong,
  },
  levelPair: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  levelChips: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  levelChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  levelChipText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.textMuted,
  },
  levelTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textBrand,
    marginTop: spacing.md,
  },
  levelDetail: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
    marginTop: 2,
  },
  gradesScroll: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  gradeButtonWrap: {
    width: 92,
  },
  gradeButton: {
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  gradeButtonText: {
    fontSize: 14,
  },
  gradeText: {
    flex: 1,
  },
  gradeWhen: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    color: colors.text,
  },
  gradeEffect: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 2,
  },
  tipsCard: {
    backgroundColor: colors.primary[50],
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.primary[200],
    padding: spacing.lg,
    gap: spacing.sm,
  },
  tipsTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textBrand,
  },
  tip: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.primary[900],
  },
  footer: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  savingText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textBrand,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger[700],
    textAlign: 'center',
  },
});
