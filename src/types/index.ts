export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface Domain {
  id: string;
  parent_id: string | null;
  name: string;
  subdomains?: Domain[];
  cardCount?: number;
  isPro?: boolean;
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
  xpPoints: number;
}

export type MascotMood = 'idle' | 'happy' | 'cheering' | 'thinking' | 'confused' | 'victorious';
