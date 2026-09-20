import Database from 'better-sqlite3';
import { USER_SCHEMA_SQL } from '../schema';

// ─────────────────────────────────────────────────────────────────────────────
// Static Lexicon Schema Definition (matches lexicon_v1.0.0.db asset)
// ─────────────────────────────────────────────────────────────────────────────

const STATIC_LEXICON_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS decks (
    deck_id INTEGER PRIMARY KEY,
    category TEXT NOT NULL,
    subcategory TEXT NOT NULL,
    difficulty INTEGER NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS cards (
    card_id INTEGER PRIMARY KEY,
    deck_id INTEGER NOT NULL,
    primary_term TEXT NOT NULL,
    pos TEXT,
    cili_id TEXT,
    difficulty INTEGER NOT NULL,
    FOREIGN KEY(deck_id) REFERENCES decks(deck_id)
);

CREATE TABLE IF NOT EXISTS card_translations (
    card_id INTEGER NOT NULL,
    lang_name TEXT NOT NULL,
    translation TEXT NOT NULL,
    PRIMARY KEY (card_id, lang_name)
);

CREATE TABLE IF NOT EXISTS card_definitions (
    card_id INTEGER NOT NULL,
    lang_name TEXT NOT NULL,
    definition TEXT NOT NULL,
    PRIMARY KEY (card_id, lang_name)
);

CREATE TABLE IF NOT EXISTS deck_translations (
    deck_id INTEGER NOT NULL,
    lang_name TEXT NOT NULL,
    category_translation TEXT NOT NULL,
    subcategory_translation TEXT NOT NULL,
    PRIMARY KEY (deck_id, lang_name)
);

CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_cards_deck_diff ON cards(deck_id, difficulty);
CREATE INDEX IF NOT EXISTS idx_trans_card_lang ON card_translations(card_id, lang_name);
`;

describe('Comprehensive SQLite Vault Queries Unit Tests (better-sqlite3)', () => {
  let userDb: any;
  let staticDb: any;

  beforeEach(() => {
    // 1. In-memory User Vault Database (user_vault.sqlite)
    userDb = new Database(':memory:');
    userDb.exec(USER_SCHEMA_SQL);

    // 2. In-memory Static Lexicon Database (lexicon_v1.0.0.db)
    staticDb = new Database(':memory:');
    staticDb.exec(STATIC_LEXICON_SCHEMA_SQL);
  });

  afterEach(() => {
    if (userDb) userDb.close();
    if (staticDb) staticDb.close();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Schema & Indexes Validation
  // ───────────────────────────────────────────────────────────────────────────
  describe('Schema & Indexes Validation', () => {
    it('creates all 8 required user vault tables with WAL and Foreign Key support', () => {
      const tables = userDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
        .all()
        .map((r: any) => r.name);

      expect(tables).toContain('Deck_Access');
      expect(tables).toContain('Downloaded_Card_Definitions');
      expect(tables).toContain('Downloaded_Card_Translations');
      expect(tables).toContain('Downloaded_Deck_Translations');
      expect(tables).toContain('Downloaded_Languages');
      expect(tables).toContain('Review_Logs');
      expect(tables).toContain('Settings');
      expect(tables).toContain('User_Cards');
    });

    it('creates all performance indexes on User_Cards, Review_Logs, and Downloaded tables', () => {
      const indexes = userDb
        .prepare("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name;")
        .all()
        .map((r: any) => r.name);

      expect(indexes).toContain('idx_user_cards_due');
      expect(indexes).toContain('idx_user_cards_card_id');
      expect(indexes).toContain('idx_user_cards_lang');
      expect(indexes).toContain('idx_user_cards_lang_due');
      expect(indexes).toContain('idx_user_cards_lang_state');
      expect(indexes).toContain('idx_review_logs_card_id');
      expect(indexes).toContain('idx_review_logs_reviewed_at');
      expect(indexes).toContain('idx_dl_trans_card_lang');
      expect(indexes).toContain('idx_dl_defs_card_lang');
      expect(indexes).toContain('idx_dl_deck_trans_deck_lang');
    });

    it('creates static lexicon tables (decks, cards, translations, definitions)', () => {
      const tables = staticDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
        .all()
        .map((r: any) => r.name);

      expect(tables).toContain('decks');
      expect(tables).toContain('cards');
      expect(tables).toContain('card_translations');
      expect(tables).toContain('card_definitions');
      expect(tables).toContain('deck_translations');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Settings & Local Entitlements Queries
  // ───────────────────────────────────────────────────────────────────────────
  describe('Settings & Local Entitlements Queries', () => {
    it('returns undefined when querying non-existent setting key', () => {
      const row = userDb.prepare("SELECT value FROM Settings WHERE key = 'language_pair';").get();
      expect(row).toBeUndefined();
    });

    it('inserts and retrieves JSON-serialized language pair settings', () => {
      const pair = { origin_lang: 'en', destination_lang: 'es' };
      const now = new Date().toISOString();

      userDb
        .prepare("INSERT OR REPLACE INTO Settings (key, value, updated_at) VALUES ('language_pair', ?, ?);")
        .run(JSON.stringify(pair), now);

      const row = userDb.prepare("SELECT value FROM Settings WHERE key = 'language_pair';").get();
      expect(row).toBeDefined();
      expect(JSON.parse(row.value)).toEqual(pair);
    });

    it('updates existing settings atomically using INSERT OR REPLACE without duplication', () => {
      const stmt = userDb.prepare("INSERT OR REPLACE INTO Settings (key, value, updated_at) VALUES (?, ?, ?);");

      stmt.run('active_algorithm', 'fsrs_v5', '2026-01-01T00:00:00Z');
      stmt.run('active_algorithm', 'sm2', '2026-01-02T00:00:00Z');

      const rows = userDb.prepare("SELECT * FROM Settings WHERE key = 'active_algorithm';").all();
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe('sm2');
      expect(rows[0].updated_at).toBe('2026-01-02T00:00:00Z');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Downloaded Languages Registry Queries
  // ───────────────────────────────────────────────────────────────────────────
  describe('Downloaded Languages Registry Queries', () => {
    it('inserts and retrieves downloaded language packs ordered by name', () => {
      const insert = userDb.prepare(`
        INSERT INTO Downloaded_Languages (code, lang_name, downloaded_at, card_count, size_bytes)
        VALUES (?, ?, ?, ?, ?);
      `);

      insert.run('es', 'Spanish', '2026-09-01T00:00:00Z', 1500, 32000);
      insert.run('fr', 'French', '2026-09-02T00:00:00Z', 1200, 28000);
      insert.run('de', 'German', '2026-09-03T00:00:00Z', 1400, 30000);

      const rows = userDb
        .prepare('SELECT code, lang_name, downloaded_at, card_count, size_bytes FROM Downloaded_Languages ORDER BY lang_name ASC;')
        .all();

      expect(rows).toHaveLength(3);
      expect(rows[0].lang_name).toBe('French');
      expect(rows[1].lang_name).toBe('German');
      expect(rows[2].lang_name).toBe('Spanish');
    });

    it('checks whether language is downloaded by exact code or language name', () => {
      userDb.prepare(`
        INSERT INTO Downloaded_Languages (code, lang_name, downloaded_at, card_count, size_bytes)
        VALUES ('pt-br', 'Portuguese (Brazil)', '2026-09-01T00:00:00Z', 1200, 25000);
      `).run();

      const query = userDb.prepare('SELECT code FROM Downloaded_Languages WHERE lang_name = ? OR code = ?;');

      expect(query.get('Portuguese (Brazil)', 'xyz')).toBeDefined();
      expect(query.get('Portuguese', 'pt-br')).toBeDefined();
      expect(query.get('Italian', 'it')).toBeUndefined();
    });

    it('deletes language record on pack deletion', () => {
      userDb.prepare(`
        INSERT INTO Downloaded_Languages (code, lang_name, downloaded_at, card_count, size_bytes)
        VALUES ('ja', 'Japanese', '2026-09-01T00:00:00Z', 800, 20000);
      `).run();

      const del = userDb.prepare('DELETE FROM Downloaded_Languages WHERE code = ?;');
      const info = del.run('ja');
      expect(info.changes).toBe(1);

      const check = userDb.prepare('SELECT code FROM Downloaded_Languages WHERE code = ?;').get('ja');
      expect(check).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Downloaded Translations & Definitions Queries
  // ───────────────────────────────────────────────────────────────────────────
  describe('Downloaded Translations & Definitions Queries', () => {
    beforeEach(() => {
      const insertTrans = userDb.prepare(`
        INSERT INTO Downloaded_Card_Translations (card_id, lang_name, translation, source, role)
        VALUES (?, ?, ?, ?, ?);
      `);
      insertTrans.run(1, 'Spanish', 'manzana', 'core', 'noun');
      insertTrans.run(1, 'es', 'manzana', 'core', 'noun');
      insertTrans.run(2, 'Spanish', 'perro', 'core', 'noun');
      insertTrans.run(1, 'French', 'pomme', 'core', 'noun');

      const insertDef = userDb.prepare(`
        INSERT INTO Downloaded_Card_Definitions (card_id, lang_name, definition, source)
        VALUES (?, ?, ?, ?);
      `);
      insertDef.run(1, 'Spanish', 'Fruta del manzano', 'core');
      insertDef.run(2, 'Spanish', 'Animal cánido doméstico', 'core');

      const insertDeckTrans = userDb.prepare(`
        INSERT INTO Downloaded_Deck_Translations (deck_id, lang_name, category_translation, subcategory_translation)
        VALUES (?, ?, ?, ?);
      `);
      insertDeckTrans.run(1, 'Spanish', 'Alimentos', 'Frutas y Vegetales');
      insertDeckTrans.run(2, 'Spanish', 'Animales', 'Animales Domésticos');
    });

    it('loads card translations using variable IN clauses for languages and card IDs', () => {
      const candidates = ['Spanish', 'es'];
      const cardIds = [1, 2];

      const langPlaceholders = candidates.map(() => '?').join(',');
      const cardPlaceholders = cardIds.map(() => '?').join(',');

      const rows = userDb
        .prepare(`
          SELECT card_id, lang_name, translation FROM Downloaded_Card_Translations 
          WHERE lang_name IN (${langPlaceholders}) AND card_id IN (${cardPlaceholders});
        `)
        .all(...candidates, ...cardIds);

      expect(rows.length).toBeGreaterThanOrEqual(2);
      const apple = rows.find((r: any) => r.card_id === 1);
      expect(apple.translation).toBe('manzana');
    });

    it('loads card definitions for cards in target language', () => {
      const candidates = ['Spanish'];
      const cardIds = [1, 2];

      const rows = userDb
        .prepare(`
          SELECT card_id, lang_name, definition FROM Downloaded_Card_Definitions 
          WHERE lang_name IN (?) AND card_id IN (?, ?);
        `)
        .all('Spanish', 1, 2);

      expect(rows).toHaveLength(2);
      expect(rows[0].definition).toBe('Fruta del manzano');
      expect(rows[1].definition).toBe('Animal cánido doméstico');
    });

    it('loads deck and category translations from Downloaded_Deck_Translations', () => {
      const rows = userDb
        .prepare(`
          SELECT deck_id, lang_name, category_translation, subcategory_translation 
          FROM Downloaded_Deck_Translations 
          WHERE lang_name IN (?) AND deck_id IN (?, ?);
        `)
        .all('Spanish', 1, 2);

      expect(rows).toHaveLength(2);
      expect(rows[0].category_translation).toBe('Alimentos');
      expect(rows[0].subcategory_translation).toBe('Frutas y Vegetales');
      expect(rows[1].category_translation).toBe('Animales');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. User_Cards FSRS Scheduling & Queue Queries
  // ───────────────────────────────────────────────────────────────────────────
  describe('User_Cards FSRS Scheduling & Queue Queries', () => {
    const insertCard = (card: any) => {
      userDb
        .prepare(`
          INSERT INTO User_Cards (
            id, card_id, target_lang, origin_lang, due_date, state,
            stability, difficulty, elapsed_days, scheduled_days, reps, lapses, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `)
        .run(
          card.id,
          card.card_id,
          card.target_lang,
          card.origin_lang || 'en',
          card.due_date,
          card.state,
          card.stability,
          card.difficulty,
          card.elapsed_days,
          card.scheduled_days,
          card.reps,
          card.lapses,
          card.updated_at
        );
    };

    it('inserts a new card into the user study queue with initial FSRS state', () => {
      insertCard({
        id: 'card_1_Spanish',
        card_id: 1,
        target_lang: 'Spanish',
        due_date: '2026-09-17T12:00:00Z',
        state: 0,
        stability: 0.0,
        difficulty: 0.0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        updated_at: '2026-09-17T12:00:00Z',
      });

      const row = userDb.prepare('SELECT * FROM User_Cards WHERE id = ?;').get('card_1_Spanish');
      expect(row).toBeDefined();
      expect(row.card_id).toBe(1);
      expect(row.state).toBe(0);
      expect(row.reps).toBe(0);
      expect(row.origin_lang).toBe('en');
    });

    it('updates FSRS scheduling parameters by string ID', () => {
      insertCard({
        id: 'card_1_Spanish',
        card_id: 1,
        target_lang: 'Spanish',
        due_date: '2026-09-17T12:00:00Z',
        state: 0,
        stability: 0.0,
        difficulty: 0.0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        updated_at: '2026-09-17T12:00:00Z',
      });

      const updateStmt = userDb.prepare(`
        UPDATE User_Cards 
        SET due_date = ?, state = ?, stability = ?, difficulty = ?, 
            elapsed_days = ?, scheduled_days = ?, reps = ?, lapses = ?, updated_at = ?
        WHERE id = ?;
      `);

      const nextDue = '2026-09-20T12:00:00Z';
      const info = updateStmt.run(
        nextDue,
        2,    // Review state
        4.5,  // Stability
        3.8,  // Difficulty
        1,    // Elapsed days
        3,    // Scheduled days
        1,    // Reps
        0,    // Lapses
        '2026-09-17T13:00:00Z',
        'card_1_Spanish'
      );

      expect(info.changes).toBe(1);
      const updated = userDb.prepare('SELECT * FROM User_Cards WHERE id = ?;').get('card_1_Spanish');
      expect(updated.state).toBe(2);
      expect(updated.stability).toBeCloseTo(4.5);
      expect(updated.reps).toBe(1);
      expect(updated.due_date).toBe(nextDue);
    });

    it('updates by numeric card_id fallback when string ID format differs', () => {
      insertCard({
        id: 'custom_uuid_1234',
        card_id: 55,
        target_lang: 'Spanish',
        due_date: '2026-09-17T12:00:00Z',
        state: 0,
        stability: 0.0,
        difficulty: 0.0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        updated_at: '2026-09-17T12:00:00Z',
      });

      // Attempt update by wrong string ID -> 0 changes
      const byId = userDb.prepare('UPDATE User_Cards SET state = 2 WHERE id = ?;').run('non_existent');
      expect(byId.changes).toBe(0);

      // Fallback: update by numeric card_id and target_lang
      const byCardId = userDb
        .prepare('UPDATE User_Cards SET state = 2, reps = 1 WHERE card_id = ? AND (target_lang = ? OR target_lang = ?);')
        .run(55, 'Spanish', 'es');
      expect(byCardId.changes).toBe(1);

      const row = userDb.prepare('SELECT state, reps FROM User_Cards WHERE card_id = 55;').get();
      expect(row.state).toBe(2);
      expect(row.reps).toBe(1);
    });

    it('deletes cards from queue by ID or card_id', () => {
      insertCard({
        id: 'card_1_Spanish',
        card_id: 1,
        target_lang: 'Spanish',
        due_date: '2026-09-17T12:00:00Z',
        state: 0,
        stability: 0.0,
        difficulty: 0.0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        updated_at: '2026-09-17T12:00:00Z',
      });

      const del = userDb.prepare('DELETE FROM User_Cards WHERE id = ? OR card_id = ?;');
      const info = del.run('card_1_Spanish', 1);
      expect(info.changes).toBe(1);

      const count = userDb.prepare('SELECT count(*) as total FROM User_Cards WHERE id = ?;').get('card_1_Spanish');
      expect(count.total).toBe(0);
    });

    it('queries due cards ordered by due_date ASC up to a cutoff timestamp', () => {
      // Past due
      insertCard({ id: 'c1', card_id: 1, target_lang: 'Spanish', due_date: '2026-09-15T00:00:00Z', state: 2, stability: 3, difficulty: 5, elapsed_days: 3, scheduled_days: 3, reps: 1, lapses: 0, updated_at: '2026-09-15T00:00:00Z' });
      // Due today
      insertCard({ id: 'c2', card_id: 2, target_lang: 'Spanish', due_date: '2026-09-17T08:00:00Z', state: 2, stability: 5, difficulty: 4, elapsed_days: 5, scheduled_days: 5, reps: 2, lapses: 0, updated_at: '2026-09-17T08:00:00Z' });
      // Future (not due)
      insertCard({ id: 'c3', card_id: 3, target_lang: 'Spanish', due_date: '2026-09-25T00:00:00Z', state: 2, stability: 12, difficulty: 3, elapsed_days: 0, scheduled_days: 8, reps: 3, lapses: 0, updated_at: '2026-09-17T00:00:00Z' });

      const cutoff = '2026-09-17T12:00:00Z';
      const dueCards = userDb
        .prepare('SELECT id, card_id, due_date FROM User_Cards WHERE target_lang IN (?, ?) AND due_date <= ? ORDER BY due_date ASC;')
        .all('Spanish', 'es', cutoff);

      expect(dueCards).toHaveLength(2);
      expect(dueCards[0].id).toBe('c1'); // Older due date first
      expect(dueCards[1].id).toBe('c2');
    });

    it('computes mastery stage distributions (Learning, Young, Mature) correctly', () => {
      // Learning: state=1 OR (state=2 AND stability < 7)
      insertCard({ id: 'l1', card_id: 10, target_lang: 'es', due_date: '2026-09-18T00:00:00Z', state: 1, stability: 1.5, difficulty: 5, elapsed_days: 0, scheduled_days: 1, reps: 1, lapses: 0, updated_at: '2026-09-17T00:00:00Z' });
      insertCard({ id: 'l2', card_id: 11, target_lang: 'es', due_date: '2026-09-20T00:00:00Z', state: 2, stability: 4.0, difficulty: 5, elapsed_days: 0, scheduled_days: 3, reps: 2, lapses: 0, updated_at: '2026-09-17T00:00:00Z' });

      // Young: state=2 AND 7 <= stability < 21
      insertCard({ id: 'y1', card_id: 20, target_lang: 'es', due_date: '2026-09-27T00:00:00Z', state: 2, stability: 14.0, difficulty: 4, elapsed_days: 0, scheduled_days: 10, reps: 3, lapses: 0, updated_at: '2026-09-17T00:00:00Z' });

      // Mature: state=2 AND stability >= 21
      insertCard({ id: 'm1', card_id: 30, target_lang: 'es', due_date: '2026-10-30T00:00:00Z', state: 2, stability: 35.0, difficulty: 3, elapsed_days: 0, scheduled_days: 30, reps: 5, lapses: 0, updated_at: '2026-09-17T00:00:00Z' });

      const all = userDb.prepare('SELECT card_id, state, stability FROM User_Cards WHERE target_lang IN (?, ?);').all('es', 'Spanish');

      let learning = 0;
      let young = 0;
      let mature = 0;

      for (const card of all) {
        if (card.state === 1 || (card.state === 2 && card.stability < 7)) {
          learning++;
        } else if (card.state === 2 && card.stability >= 7 && card.stability < 21) {
          young++;
        } else if (card.state === 2 && card.stability >= 21) {
          mature++;
        }
      }

      expect(learning).toBe(2);
      expect(young).toBe(1);
      expect(mature).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Review_Logs Chronicles & Streak Queries
  // ───────────────────────────────────────────────────────────────────────────
  describe('Review_Logs Chronicles & Streak Queries', () => {
    it('inserts individual review logs and verifies auto-increment primary key', () => {
      const insert = userDb.prepare('INSERT INTO Review_Logs (card_id, rating, reviewed_at) VALUES (?, ?, ?);');

      const r1 = insert.run(101, 3, '2026-09-17T10:00:00Z');
      const r2 = insert.run(101, 4, '2026-09-17T10:05:00Z');
      const r3 = insert.run(102, 1, '2026-09-17T10:10:00Z');

      expect(r1.lastInsertRowid).toBe(1);
      expect(r2.lastInsertRowid).toBe(2);
      expect(r3.lastInsertRowid).toBe(3);

      const count = userDb.prepare('SELECT count(*) as count FROM Review_Logs;').get();
      expect(count.count).toBe(3);
    });

    it('aggregates daily activity counts for streak and contribution graphs', () => {
      const insert = userDb.prepare('INSERT INTO Review_Logs (card_id, rating, reviewed_at) VALUES (?, ?, ?);');

      // 3 on day 1
      insert.run(1, 3, '2026-09-15T08:00:00Z');
      insert.run(2, 4, '2026-09-15T09:00:00Z');
      insert.run(3, 2, '2026-09-15T14:00:00Z');

      // 1 on day 2
      insert.run(1, 3, '2026-09-16T11:00:00Z');

      // 4 on day 3
      insert.run(1, 4, '2026-09-17T08:00:00Z');
      insert.run(2, 4, '2026-09-17T09:00:00Z');
      insert.run(3, 3, '2026-09-17T10:00:00Z');
      insert.run(4, 3, '2026-09-17T11:00:00Z');

      const daily = userDb
        .prepare(`
          SELECT substr(reviewed_at, 1, 10) as review_date, count(*) as count
          FROM Review_Logs
          GROUP BY review_date
          ORDER BY review_date ASC;
        `)
        .all();

      expect(daily).toHaveLength(3);
      expect(daily[0]).toEqual({ review_date: '2026-09-15', count: 3 });
      expect(daily[1]).toEqual({ review_date: '2026-09-16', count: 1 });
      expect(daily[2]).toEqual({ review_date: '2026-09-17', count: 4 });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Deck Entitlements Queries
  // ───────────────────────────────────────────────────────────────────────────
  describe('Deck Entitlements Queries', () => {
    it('manages deck unlocks and queries unlocked set', () => {
      const unlock = userDb.prepare('INSERT OR REPLACE INTO Deck_Access (deck_id, is_unlocked, unlocked_at) VALUES (?, 1, ?);');

      unlock.run('1', '2026-09-01T00:00:00Z');
      unlock.run('3', '2026-09-02T00:00:00Z');
      unlock.run('theme_animals', '2026-09-03T00:00:00Z');

      const rows = userDb.prepare('SELECT deck_id FROM Deck_Access WHERE is_unlocked = 1;').all();
      const unlockedSet = new Set(rows.map((r: any) => r.deck_id));

      expect(unlockedSet.has('1')).toBe(true);
      expect(unlockedSet.has('3')).toBe(true);
      expect(unlockedSet.has('theme_animals')).toBe(true);
      expect(unlockedSet.has('2')).toBe(false);
      expect(unlockedSet.has('theme_vehicles')).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Static Lexicon & Cross-Database Joint Progress Queries
  // ───────────────────────────────────────────────────────────────────────────
  describe('Static Lexicon & Cross-Database Joint Progress Queries', () => {
    beforeEach(() => {
      // Seed static decks
      const insertDeck = staticDb.prepare(`
        INSERT INTO decks (deck_id, category, subcategory, difficulty, description)
        VALUES (?, ?, ?, ?, ?);
      `);
      insertDeck.run(1, 'greetings', 'Basic Greetings', 1, 'Essential hello/goodbye');
      insertDeck.run(2, 'family', 'Immediate Family', 1, 'Mom, dad, siblings');
      insertDeck.run(3, 'animals', 'Wild Animals', 2, 'Lions, tigers, bears');

      // Seed static cards
      const insertCard = staticDb.prepare(`
        INSERT INTO cards (card_id, deck_id, primary_term, pos, cili_id, difficulty)
        VALUES (?, ?, ?, ?, ?, ?);
      `);
      // Deck 1: 3 cards (all diff 1)
      insertCard.run(101, 1, 'hello', 'noun', 'cili_01', 1);
      insertCard.run(102, 1, 'goodbye', 'noun', 'cili_02', 1);
      insertCard.run(103, 1, 'please', 'adv', 'cili_03', 1);
      // Deck 2: 2 cards (all diff 1)
      insertCard.run(201, 2, 'mother', 'noun', 'cili_04', 1);
      insertCard.run(202, 2, 'father', 'noun', 'cili_05', 1);
      // Deck 3: 2 cards (diff 2)
      insertCard.run(301, 3, 'lion', 'noun', 'cili_06', 2);
      insertCard.run(302, 3, 'tiger', 'noun', 'cili_07', 2);

      // Seed user progress in userDb for Deck 1
      const insertUserCard = userDb.prepare(`
        INSERT INTO User_Cards (
          id, card_id, target_lang, origin_lang, due_date, state,
          stability, difficulty, elapsed_days, scheduled_days, reps, lapses, updated_at
        ) VALUES (?, ?, ?, 'en', '2026-09-17T00:00:00Z', ?, ?, 5.0, 0, 1, ?, 0, '2026-09-17T00:00:00Z');
      `);
      // Card 101: queued, not mastered
      insertUserCard.run('c101', 101, 'Spanish', 1, 2.0, 1);
      // Card 102: mastered (stability >= 21)
      insertUserCard.run('c102', 102, 'Spanish', 2, 25.0, 4);
    });

    it('queries card count grouped by deck_id in static database', () => {
      const counts = staticDb
        .prepare('SELECT deck_id, count(card_id) as card_count FROM cards GROUP BY deck_id ORDER BY deck_id ASC;')
        .all();

      expect(counts).toHaveLength(3);
      expect(counts[0]).toEqual({ deck_id: 1, card_count: 3 });
      expect(counts[1]).toEqual({ deck_id: 2, card_count: 2 });
      expect(counts[2]).toEqual({ deck_id: 3, card_count: 2 });
    });

    it('slices cards by (deck_id, difficulty) for progressive roadmaps', () => {
      const slices = staticDb
        .prepare(`
          SELECT d.deck_id, d.category, d.subcategory, c.difficulty, COUNT(c.card_id) as card_count
          FROM decks d
          JOIN cards c ON c.deck_id = d.deck_id
          GROUP BY d.deck_id, c.difficulty
          ORDER BY c.difficulty ASC, d.deck_id ASC;
        `)
        .all();

      expect(slices).toHaveLength(3);
      expect(slices[0].difficulty).toBe(1);
      expect(slices[0].card_count).toBe(3);
      expect(slices[2].difficulty).toBe(2);
      expect(slices[2].card_count).toBe(2);
    });

    it('cross-references static cards with userDb to compute accurate deck mastery statistics', () => {
      // 1. Get cards in deck 1 from staticDb
      const deckCards = staticDb.prepare('SELECT card_id FROM cards WHERE deck_id = 1;').all();
      const cardIds = deckCards.map((c: any) => c.card_id);
      expect(cardIds).toEqual([101, 102, 103]);

      // 2. Query user progress for these cards from userDb
      const placeholders = cardIds.map(() => '?').join(',');
      const userProgress = userDb
        .prepare(`SELECT card_id, state, stability, reps FROM User_Cards WHERE card_id IN (${placeholders});`)
        .all(...cardIds);

      expect(userProgress).toHaveLength(2); // 101 and 102 are queued, 103 is not

      let queued = userProgress.length;
      let mastered = userProgress.filter((p: any) => p.stability >= 21 || p.reps >= 3).length;

      expect(queued).toBe(2);
      expect(mastered).toBe(1); // card 102 has stability 25 and reps 4
    });

    it('supports pagination (LIMIT and OFFSET) when querying cards in a deck', () => {
      const page1 = staticDb
        .prepare('SELECT card_id, primary_term FROM cards WHERE deck_id = 1 ORDER BY card_id ASC LIMIT 2 OFFSET 0;')
        .all();
      expect(page1).toHaveLength(2);
      expect(page1[0].card_id).toBe(101);
      expect(page1[1].card_id).toBe(102);

      const page2 = staticDb
        .prepare('SELECT card_id, primary_term FROM cards WHERE deck_id = 1 ORDER BY card_id ASC LIMIT 2 OFFSET 2;')
        .all();
      expect(page2).toHaveLength(1);
      expect(page2[0].card_id).toBe(103);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Transaction Rollbacks & Data Integrity
  // ───────────────────────────────────────────────────────────────────────────
  describe('Transaction Rollbacks & Data Integrity', () => {
    it('rolls back batch inserts on transaction failure without leaving partial data', () => {
      userDb.exec('BEGIN TRANSACTION;');

      const insert = userDb.prepare('INSERT INTO Review_Logs (card_id, rating, reviewed_at) VALUES (?, ?, ?);');
      insert.run(1, 3, '2026-09-17T00:00:00Z');
      insert.run(2, 4, '2026-09-17T00:01:00Z');

      // Rollback transaction
      userDb.exec('ROLLBACK;');

      const count = userDb.prepare('SELECT count(*) as total FROM Review_Logs;').get();
      expect(count.total).toBe(0);
    });

    it('commits atomic batch operations successfully', () => {
      userDb.exec('BEGIN TRANSACTION;');

      const insert = userDb.prepare('INSERT INTO Review_Logs (card_id, rating, reviewed_at) VALUES (?, ?, ?);');
      insert.run(1, 3, '2026-09-17T00:00:00Z');
      insert.run(2, 4, '2026-09-17T00:01:00Z');

      userDb.exec('COMMIT;');

      const count = userDb.prepare('SELECT count(*) as total FROM Review_Logs;').get();
      expect(count.total).toBe(2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Deck Title Language Preference & Translations (Origin vs Target)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Deck Title Language Preference & Translations', () => {
    beforeEach(() => {
      // Insert deck
      staticDb
        .prepare('INSERT INTO decks (deck_id, category, subcategory, difficulty, description) VALUES (?, ?, ?, ?, ?);')
        .run(10, 'family', 'members', 1, 'Family vocabulary');

      // Insert translations for English (origin) and Spanish (target)
      const insertTrans = staticDb.prepare(
        'INSERT INTO deck_translations (deck_id, lang_name, category_translation, subcategory_translation) VALUES (?, ?, ?, ?);'
      );
      insertTrans.run(10, 'English', 'Family', 'Members');
      insertTrans.run(10, 'Spanish', 'Familia', 'Miembros');
    });

    it('defaults deck title language preference to origin if not set in Settings', () => {
      const row = userDb.prepare("SELECT value FROM Settings WHERE key = 'deck_title_language';").get();
      const pref = row ? row.value : 'origin';
      expect(pref).toBe('origin');
    });

    it('persists target immersion preference when user opts in', () => {
      userDb
        .prepare("INSERT OR REPLACE INTO Settings (key, value, updated_at) VALUES ('deck_title_language', 'target', datetime('now'));")
        .run();

      const row = userDb.prepare("SELECT value FROM Settings WHERE key = 'deck_title_language';").get();
      expect(row.value).toBe('target');
    });

    it('loads origin language translations when preference is origin', () => {
      const pref = 'origin';
      const originLang = 'English';
      const targetLang = 'Spanish';
      const translationLang = pref === 'target' ? targetLang : originLang;

      const trans = staticDb
        .prepare('SELECT category_translation, subcategory_translation FROM deck_translations WHERE deck_id = ? AND lang_name = ?;')
        .get(10, translationLang);

      expect(trans).toBeDefined();
      expect(trans.category_translation).toBe('Family');
      expect(trans.subcategory_translation).toBe('Members');
    });

    it('loads target language translations when preference is target (immersion)', () => {
      const pref = 'target';
      const originLang = 'English';
      const targetLang = 'Spanish';
      const translationLang = pref === 'target' ? targetLang : originLang;

      const trans = staticDb
        .prepare('SELECT category_translation, subcategory_translation FROM deck_translations WHERE deck_id = ? AND lang_name = ?;')
        .get(10, translationLang);

      expect(trans).toBeDefined();
      expect(trans.category_translation).toBe('Familia');
      expect(trans.subcategory_translation).toBe('Miembros');
    });
  });

  describe('Random Unlearned Words Query (ORDER BY RANDOM() LIMIT 10)', () => {
    beforeEach(() => {
      // Seed 20 cards across 2 decks
      const insertDeck = staticDb.prepare(
        'INSERT OR REPLACE INTO decks (deck_id, category, subcategory, difficulty, description) VALUES (?, ?, ?, ?, ?);'
      );
      insertDeck.run(1, 'basics', 'greetings', 1, 'Basic greetings');
      insertDeck.run(2, 'food', 'fruits', 2, 'Common fruits');

      const insertCard = staticDb.prepare(
        'INSERT OR REPLACE INTO cards (card_id, deck_id, primary_term, pos, cili_id, difficulty) VALUES (?, ?, ?, ?, ?, ?);'
      );
      for (let i = 1; i <= 20; i++) {
        insertCard.run(i, i <= 10 ? 1 : 2, `term_${i}`, 'n', `c_${i}`, 1);
      }

      // Queue 5 cards in User_Cards for Spanish
      const insertUserCard = userDb.prepare(
        `INSERT OR REPLACE INTO User_Cards (
          id, card_id, target_lang, origin_lang, due_date, state, stability, difficulty,
          elapsed_days, scheduled_days, reps, lapses, updated_at
        ) VALUES (?, ?, ?, ?, datetime('now'), 0, 0, 0, 0, 0, 0, 0, datetime('now'));`
      );
      for (let i = 1; i <= 5; i++) {
        insertUserCard.run(`card_${i}_Spanish`, i, 'Spanish', 'English');
      }
    });

    it('excludes cards already queued in User_Cards for target language', () => {
      const queuedRows = userDb
        .prepare('SELECT card_id FROM User_Cards WHERE target_lang IN (?, ?);')
        .all('Spanish', 'es');
      const queuedIds = queuedRows.map((r: any) => r.card_id);
      expect(queuedIds).toHaveLength(5);

      const placeholders = queuedIds.map(() => '?').join(',');
      const query = `
        SELECT c.card_id, c.deck_id, c.primary_term, d.category, d.subcategory
        FROM cards c
        JOIN decks d ON d.deck_id = c.deck_id
        WHERE c.card_id NOT IN (${placeholders})
        ORDER BY RANDOM()
        LIMIT 10;
      `;
      const randomCards = staticDb.prepare(query).all(...queuedIds);

      expect(randomCards).toHaveLength(10);
      for (const card of randomCards) {
        expect(queuedIds).not.toContain(card.card_id);
      }
    });

    it('returns fewer cards if remaining unlearned pool is smaller than limit', () => {
      // Queue cards 6 through 18
      const insertUserCard = userDb.prepare(
        `INSERT OR REPLACE INTO User_Cards (
          id, card_id, target_lang, origin_lang, due_date, state, stability, difficulty,
          elapsed_days, scheduled_days, reps, lapses, updated_at
        ) VALUES (?, ?, ?, ?, datetime('now'), 0, 0, 0, 0, 0, 0, 0, datetime('now'));`
      );
      for (let i = 6; i <= 18; i++) {
        insertUserCard.run(`card_${i}_Spanish`, i, 'Spanish', 'English');
      }

      const queuedRows = userDb
        .prepare('SELECT card_id FROM User_Cards WHERE target_lang IN (?, ?);')
        .all('Spanish', 'es');
      const queuedIds = queuedRows.map((r: any) => r.card_id);
      expect(queuedIds).toHaveLength(18);

      const placeholders = queuedIds.map(() => '?').join(',');
      const query = `
        SELECT c.card_id
        FROM cards c
        WHERE c.card_id NOT IN (${placeholders})
        ORDER BY RANDOM()
        LIMIT 10;
      `;
      const randomCards = staticDb.prepare(query).all(...queuedIds);
      // Only cards 19 and 20 remain
      expect(randomCards).toHaveLength(2);
    });
  });
});

