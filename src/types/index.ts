export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface Domain {
  id: string;
  parent_id: string | null;
  name: string;
  description?: string;
  difficulty_level?: number;
  icon_name?: string;
  subdomains?: Domain[];
  cardCount?: number;
  isPro?: boolean;
  is_introductory?: boolean;
}

export interface DeckWithProgress {
  id: string;
  theme_id: string;
  theme_name?: string;
  name: string;
  description: string;
  difficulty_level: number;
  difficulty_label: string;
  cefr_level: string;
  icon_name: string;
  card_count: number;
  queued_count: number;
  mastered_count: number;
  is_pro: boolean;
  is_locked?: boolean;
  difficulty_slice?: number;
  real_deck_id?: number;
}

export interface ThemeGroup {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  is_pro: boolean;
  decks: DeckWithProgress[];
}

export interface DeckCardDetail {
  concept_id: string;
  concept_desc: string;
  front_lexeme_id: number;
  front_term: string;
  front_lang: string;
  front_pos: string | null;
  front_cefr: string;
  back_lexeme_id: number;
  back_term: string;
  back_lang: string;
  is_queued: boolean;
  user_card_id?: string;
  stability?: number;
  reps?: number;
}

export interface Concept {
  id: string;
  domain_id: string;
  description: string;
}

export interface Lexeme {
  id: number;
  language: string;
  term: string;
  pos: string | null;
  cefr_level: CEFRLevel | string;
  frequency_rank: number | null;
}

export interface UserCard {
  id: string;
  card_id?: number;
  target_lang?: string;
  front_lexeme_id: number;
  back_lexeme_id: number;
  due_date: string;
  state: number; // 0=New, 1=Learning, 2=Review, 3=Relearning
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  updated_at: string;
}

export interface CardWithDetails extends UserCard {
  front_term: string;
  front_lang: string;
  front_pos: string | null;
  front_cefr: string;
  back_term: string;
  back_lang: string;
  back_pos: string | null;
  back_cefr: string;
  concept_desc: string;
}

export interface VaultStats {
  totalCards: number;
  dueCards: number;
  newCards: number;
  masteredCards: number;
  streakDays: number;
}

export type MascotMood = 'idle' | 'happy' | 'cheering' | 'thinking' | 'confused' | 'victorious';

export interface ActivityDay {
  date: string; // YYYY-MM-DD
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface ActivityWeek {
  days: (ActivityDay | null)[]; // 7 days (index 0 = Sunday, 6 = Saturday)
}

export interface ProgressOverview {
  currentStreak: number;
  longestStreak: number;
  totalReviews: number;
  todayReviews: number;
  masteredCards: number;
  totalCards: number;
  gridWeeks: ActivityWeek[];
  monthLabels: { weekIndex: number; label: string }[];
  weeklyDistribution: { day: string; count: number }[];
}

export type MasteryStage = 'slipping' | 'learning' | 'mastered' | 'new_in_queue' | 'available';

export interface DifficultyWordItem {
  concept_id: string;
  concept_desc: string;
  front_lexeme_id: number;
  front_term: string;
  front_lang: string;
  front_pos: string | null;
  front_cefr: string;
  back_lexeme_id: number;
  back_term: string;
  back_lang: string;
  deck_name: string;
  theme_name: string;
  frequency_rank: number | null;
  is_queued: boolean;
  user_card_id?: string;
  stability?: number;
  reps?: number;
  lapses?: number;
  due_date?: string;
  state?: number;
}

export interface DifficultyStat {
  cefr: CEFRLevel;
  label: string;
  tier: number;
  total_count: number;
  queued_count: number;
  mastered_count: number;
  available_count: number;
}

export interface MasteryWordItem {
  concept_id: string;
  concept_desc: string;
  front_lexeme_id: number;
  front_term: string;
  front_lang: string;
  front_pos: string | null;
  front_cefr: string;
  back_lexeme_id: number;
  back_term: string;
  back_lang: string;
  deck_name?: string;
  theme_name?: string;
  is_queued: boolean;
  user_card_id?: string;
  stage: MasteryStage;
  stability?: number;
  scheduled_days?: number;
  reps?: number;
  lapses?: number;
  due_date?: string;
  state?: number;
}

export interface MasterySummary {
  slipping_count: number;
  learning_count: number;
  mastered_count: number;
  new_queue_count: number;
  available_count: number;
  total_library_count: number;
}

export interface DownloadedLanguage {
  code: string;
  lang_name: string;
  downloaded_at: string;
  card_count: number;
  size_bytes: number;
}

export interface LanguagePairSettings {
  origin_lang: string; // e.g. 'es' (App UI & Back of card)
  destination_lang: string; // e.g. 'en' (Target study language on front of card)
}

export interface LanguagePairProgress {
  totalCards: number;
  dueCards: number;
  newCards: number;
  masteredCards: number;
}

export interface EnrolledLanguagePair {
  id: string; // e.g. 'es:en'
  origin_lang: string;
  destination_lang: string;
  origin_name: string;
  destination_name: string;
  enrolled_at: string;
  progress: LanguagePairProgress;
}

