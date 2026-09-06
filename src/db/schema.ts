export const SCHEMA_SQL = `
-- Enable WAL mode & Foreign keys
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Hierarchical Decks (Domains & Subdomains)
CREATE TABLE IF NOT EXISTS Domains (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    name TEXT NOT NULL,
    FOREIGN KEY(parent_id) REFERENCES Domains(id)
);

-- Semantic Concepts (OMW V2 CILI Anchors)
CREATE TABLE IF NOT EXISTS Concepts (
    id TEXT PRIMARY KEY,
    domain_id TEXT,
    description TEXT NOT NULL,
    FOREIGN KEY(domain_id) REFERENCES Domains(id)
);

-- Lexemes (Words across all languages with CEFR tags)
CREATE TABLE IF NOT EXISTS Lexemes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language TEXT NOT NULL,
    term TEXT NOT NULL,
    pos TEXT,
    cefr_level TEXT,
    frequency_rank INTEGER
);

-- Full-Text Search Virtual Table
CREATE VIRTUAL TABLE IF NOT EXISTS Lexemes_FTS USING fts5(
    term,
    language,
    content='Lexemes',
    content_rowid='id'
);

-- FTS Synchronization Triggers
CREATE TRIGGER IF NOT EXISTS lexemes_ai AFTER INSERT ON Lexemes BEGIN
    INSERT INTO Lexemes_FTS(rowid, term, language) VALUES (new.id, new.term, new.language);
END;

CREATE TRIGGER IF NOT EXISTS lexemes_ad AFTER DELETE ON Lexemes BEGIN
    INSERT INTO Lexemes_FTS(Lexemes_FTS, rowid, term, language) VALUES('delete', old.id, old.term, old.language);
END;

CREATE TRIGGER IF NOT EXISTS lexemes_au AFTER UPDATE ON Lexemes BEGIN
    INSERT INTO Lexemes_FTS(Lexemes_FTS, rowid, term, language) VALUES('delete', old.id, old.term, old.language);
    INSERT INTO Lexemes_FTS(rowid, term, language) VALUES (new.id, new.term, new.language);
END;

-- Matrix / Junction Table (Solving Polysemy)
CREATE TABLE IF NOT EXISTS Concept_Lexeme (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    concept_id TEXT NOT NULL,
    lexeme_id INTEGER NOT NULL,
    FOREIGN KEY(concept_id) REFERENCES Concepts(id),
    FOREIGN KEY(lexeme_id) REFERENCES Lexemes(id)
);

-- User Cards (The Garrison / Local FSRS State)
CREATE TABLE IF NOT EXISTS User_Cards (
    id TEXT PRIMARY KEY,
    front_lexeme_id INTEGER NOT NULL,
    back_lexeme_id INTEGER NOT NULL,
    due_date DATETIME NOT NULL,
    state INTEGER NOT NULL,
    stability REAL NOT NULL,
    difficulty REAL NOT NULL,
    elapsed_days INTEGER NOT NULL,
    scheduled_days INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    lapses INTEGER NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(front_lexeme_id) REFERENCES Lexemes(id),
    FOREIGN KEY(back_lexeme_id) REFERENCES Lexemes(id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_due_date ON User_Cards(due_date);
CREATE INDEX IF NOT EXISTS idx_lexeme_lang ON Lexemes(language);
CREATE INDEX IF NOT EXISTS idx_concept_lexeme ON Concept_Lexeme(concept_id);
CREATE INDEX IF NOT EXISTS idx_concepts_domain ON Concepts(domain_id);
`;
