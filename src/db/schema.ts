export const USER_SCHEMA_SQL = `
-- Enable WAL mode & Foreign keys
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- User Cards (Local FSRS State)
CREATE TABLE IF NOT EXISTS User_Cards (
    id TEXT PRIMARY KEY,
    card_id INTEGER NOT NULL,
    target_lang TEXT NOT NULL,
    origin_lang TEXT DEFAULT 'en',
    due_date DATETIME NOT NULL,
    state INTEGER NOT NULL,
    stability REAL NOT NULL,
    difficulty REAL NOT NULL,
    elapsed_days INTEGER NOT NULL,
    scheduled_days INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    lapses INTEGER NOT NULL,
    updated_at DATETIME NOT NULL
);

-- Review Logs (Activity & Contribution History)
CREATE TABLE IF NOT EXISTS Review_Logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    reviewed_at DATETIME NOT NULL
);

-- Deck Access & Entitlements
CREATE TABLE IF NOT EXISTS Deck_Access (
    deck_id TEXT PRIMARY KEY,
    is_unlocked INTEGER DEFAULT 0,
    unlocked_at DATETIME
);

-- Settings & Local Entitlements (Offline-First Store State)
CREATE TABLE IF NOT EXISTS Settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME NOT NULL
);

-- Downloaded Language Packages Registry (Disk Optimization)
CREATE TABLE IF NOT EXISTS Downloaded_Languages (
    code TEXT PRIMARY KEY,
    lang_name TEXT NOT NULL,
    downloaded_at DATETIME NOT NULL,
    card_count INTEGER DEFAULT 0,
    size_bytes INTEGER DEFAULT 0
);

-- Downloaded Dictionary Translations (Isolated from User Study Data)
CREATE TABLE IF NOT EXISTS Downloaded_Card_Translations (
    card_id INTEGER NOT NULL,
    lang_name TEXT NOT NULL,
    translation TEXT NOT NULL,
    source TEXT,
    role TEXT,
    PRIMARY KEY (card_id, lang_name)
);

-- Downloaded Dictionary Definitions (Isolated from User Study Data)
CREATE TABLE IF NOT EXISTS Downloaded_Card_Definitions (
    card_id INTEGER NOT NULL,
    lang_name TEXT NOT NULL,
    definition TEXT NOT NULL,
    source TEXT,
    PRIMARY KEY (card_id, lang_name)
);

-- Downloaded Deck Translations (Deck and Category Names per Language)
CREATE TABLE IF NOT EXISTS Downloaded_Deck_Translations (
    deck_id INTEGER NOT NULL,
    lang_name TEXT NOT NULL,
    category_translation TEXT NOT NULL,
    subcategory_translation TEXT NOT NULL,
    source TEXT,
    PRIMARY KEY (deck_id, lang_name)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_user_cards_due ON User_Cards(due_date);
CREATE INDEX IF NOT EXISTS idx_user_cards_card_id ON User_Cards(card_id);
CREATE INDEX IF NOT EXISTS idx_user_cards_lang ON User_Cards(target_lang);
CREATE INDEX IF NOT EXISTS idx_user_cards_lang_due ON User_Cards(target_lang, due_date);
CREATE INDEX IF NOT EXISTS idx_user_cards_lang_card ON User_Cards(target_lang, card_id);
CREATE INDEX IF NOT EXISTS idx_user_cards_lang_state ON User_Cards(target_lang, state);
CREATE INDEX IF NOT EXISTS idx_user_cards_lang_stability ON User_Cards(target_lang, stability);
CREATE INDEX IF NOT EXISTS idx_user_cards_lang_reps ON User_Cards(target_lang, reps);
CREATE INDEX IF NOT EXISTS idx_user_cards_due_state ON User_Cards(due_date, state);
CREATE INDEX IF NOT EXISTS idx_user_cards_stability ON User_Cards(stability);

CREATE INDEX IF NOT EXISTS idx_review_logs_card_id ON Review_Logs(card_id);
CREATE INDEX IF NOT EXISTS idx_review_logs_reviewed_at ON Review_Logs(reviewed_at);

CREATE INDEX IF NOT EXISTS idx_dl_trans_lang ON Downloaded_Card_Translations(lang_name);
CREATE INDEX IF NOT EXISTS idx_dl_trans_card_lang ON Downloaded_Card_Translations(card_id, lang_name);
CREATE INDEX IF NOT EXISTS idx_dl_defs_lang ON Downloaded_Card_Definitions(lang_name);
CREATE INDEX IF NOT EXISTS idx_dl_defs_card_lang ON Downloaded_Card_Definitions(card_id, lang_name);
CREATE INDEX IF NOT EXISTS idx_dl_deck_trans_lang ON Downloaded_Deck_Translations(lang_name);
CREATE INDEX IF NOT EXISTS idx_dl_deck_trans_deck_lang ON Downloaded_Deck_Translations(deck_id, lang_name);
`;
