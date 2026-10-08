import Database from 'better-sqlite3';
import path from 'path';
import {
  DeckRow,
  DeckTitleTranslation,
  buildDeckLabels,
  groupDecksIntoThemes,
  resolveDeckIcon,
} from '../deckHierarchy';
import { DeckWithProgress } from '../../types';

const row = (
  deck_id: number,
  theme: string,
  deck: string,
  subdeck: string,
  subtheme = ''
): DeckRow => ({
  deck_id,
  theme,
  subtheme,
  deck,
  subdeck,
  difficulty: 1,
});

const tr = (theme: string, deck: string, subdeck: string, subtheme = ''): DeckTitleTranslation => ({
  theme,
  subtheme,
  deck,
  subdeck,
});

function toLeaf(
  r: DeckRow,
  labels: ReturnType<typeof buildDeckLabels>,
  cards = 5
): DeckWithProgress {
  const l = labels.get(r.deck_id)!;
  return {
    id: String(r.deck_id),
    real_deck_id: r.deck_id,
    theme_id: l.themeKey,
    theme_name: l.themeName,
    subtheme_name: l.subthemeName || undefined,
    deck_key: l.deckKey,
    deck_name: l.deckName,
    subdeck_name: l.subdeckName,
    has_subdecks: l.hasSubdecks,
    is_main_subdeck: !r.subdeck || r.subdeck === r.deck,
    name: l.displayName,
    full_name: l.fullName,
    subtitle: l.subtitle,
    description: '',
    difficulty_level: 1,
    difficulty_label: 'A1',
    cefr_level: 'A1',
    icon_name: resolveDeckIcon(r.theme, r.deck, r.subdeck),
    card_count: cards,
    queued_count: 1,
    mastered_count: 0,
    is_pro: false,
    is_locked: false,
  };
}

describe('buildDeckLabels', () => {
  const rows = [
    row(3, 'animals', 'insects', 'insects'),
    row(39, 'animals', 'insects', 'beetles'),
    row(45, 'animals', 'insects', 'habitats'),
    row(2, 'animals', 'domestic animals', 'domestic animals'),
    row(44, 'home', 'pets', 'traits'),
  ];

  it('names subdecks of a split deck with their parent deck outside the hierarchy', () => {
    const labels = buildDeckLabels(rows, new Map());
    expect(labels.get(39)).toMatchObject({
      themeName: 'Animals',
      deckName: 'Insects',
      subdeckName: 'Beetles',
      hasSubdecks: true,
      displayName: 'Beetles',
      fullName: 'Insects › Beetles',
    });
    expect(labels.get(3)?.fullName).toBe('Insects › Insects');
  });

  it('keeps an unsplit deck under its deck name', () => {
    const labels = buildDeckLabels(rows, new Map());
    expect(labels.get(2)).toMatchObject({
      displayName: 'Domestic Animals',
      fullName: 'Domestic Animals',
      hasSubdecks: false,
    });
    expect(labels.get(2)?.subtitle).toBeUndefined();
  });

  it('shows a lone subdeck with its own name as a subtitle', () => {
    const labels = buildDeckLabels(rows, new Map());
    expect(labels.get(44)).toMatchObject({
      displayName: 'Pets',
      fullName: 'Pets',
      subtitle: 'Traits',
    });
  });

  it('skips the subtitle when the deck name already says it', () => {
    const labels = buildDeckLabels([row(1, 'family', 'family members', 'members')], new Map());
    expect(labels.get(1)?.subtitle).toBeUndefined();
  });

  it('takes the deck translation from the subdeck named after the deck, not a stray row', () => {
    const translations = new Map([
      [3, tr('animales', 'insectos', 'insectos')],
      [39, tr('animales', 'escarabajos', 'escarabajos')],
    ]);
    const labels = buildDeckLabels(rows, translations);
    expect(labels.get(39)).toMatchObject({
      deckName: 'Insectos',
      subdeckName: 'Escarabajos',
      themeName: 'Animales',
    });
    // Untranslated subdeck falls back to its English name, under the translated deck
    expect(labels.get(45)?.fullName).toBe('Insectos › Habitats');
  });

  it('labels subthemes when the lexicon defines them', () => {
    const labels = buildDeckLabels(
      [row(1, 'sports', 'basketball', 'rules', 'ball games')],
      new Map()
    );
    expect(labels.get(1)?.subthemeName).toBe('Ball Games');
  });
});

describe('groupDecksIntoThemes', () => {
  it('nests subdecks under one deck group with summed progress, main subdeck first', () => {
    const rows = [
      row(39, 'animals', 'insects', 'beetles'),
      row(3, 'animals', 'insects', 'insects'),
      row(2, 'animals', 'domestic animals', 'domestic animals'),
    ];
    const labels = buildDeckLabels(rows, new Map());
    const themes = groupDecksIntoThemes(rows.map((r) => toLeaf(r, labels)));

    expect(themes).toHaveLength(1);
    const [insects, domestic] = themes[0].deck_groups;
    expect(insects.name).toBe('Insects');
    expect(insects.subdecks.map((d) => d.id)).toEqual(['3', '39']);
    expect(insects.card_count).toBe(10);
    expect(insects.queued_count).toBe(2);
    expect(domestic.subdecks).toHaveLength(1);
    expect(themes[0].decks).toHaveLength(3);
  });

  it('orders beginner themes first, then the rest alphabetically', () => {
    const rows = [
      row(1, 'sports', 'a', 'a'),
      row(2, 'military', 'b', 'b'),
      row(3, 'basics', 'c', 'c'),
    ];
    const labels = buildDeckLabels(rows, new Map());
    const themes = groupDecksIntoThemes(rows.map((r) => toLeaf(r, labels)));
    expect(themes.map((t) => t.id)).toEqual(['theme_basics', 'theme_military', 'theme_sports']);
  });
});

describe('lexicon asset (lexicon_v1.0.0.db)', () => {
  const db = new Database(path.join(__dirname, '../../../assets/lexicon_v1.0.0.db'), {
    readonly: true,
  });
  afterAll(() => db.close());

  const catalog: DeckRow[] = db
    .prepare(
      'SELECT deck_id, theme, subtheme, deck, subdeck, difficulty FROM decks ORDER BY deck_id ASC;'
    )
    .all();

  it('has the theme/deck/subdeck columns the app reads', () => {
    expect(catalog.length).toBeGreaterThan(0);
    const transCols = db
      .prepare('PRAGMA table_info(deck_translations);')
      .all()
      .map((c: any) => c.name);
    expect(transCols).toEqual(
      expect.arrayContaining([
        'theme_translation',
        'subtheme_translation',
        'deck_translation',
        'subdeck_translation',
      ])
    );
  });

  it('gives every deck a label and every subdeck of a split deck a distinct name', () => {
    const labels = buildDeckLabels(catalog, new Map());
    expect(labels.size).toBe(catalog.length);
    const fullNames = catalog.map((r) => `${r.theme}|${labels.get(r.deck_id)!.fullName}`);
    expect(new Set(fullNames).size).toBe(fullNames.length);
  });

  it('groups split decks such as Insects and Basketball', () => {
    const labels = buildDeckLabels(catalog, new Map());
    const themes = groupDecksIntoThemes(catalog.map((r) => toLeaf(r, labels)));
    const animals = themes.find((t) => t.id === 'theme_animals')!;
    const insects = animals.deck_groups.find((g) => g.name === 'Insects')!;
    expect(insects.subdecks.length).toBeGreaterThan(1);
    expect(insects.subdecks[0].name).toBe('Insects');
    const sports = themes.find((t) => t.id === 'theme_sports')!;
    expect(
      sports.deck_groups.find((g) => g.name === 'Basketball')!.subdecks.length
    ).toBeGreaterThan(1);
  });

  it('keeps one deck name per group with real Spanish translations', () => {
    const rows: any[] = db
      .prepare(
        "SELECT deck_id, theme_translation, subtheme_translation, deck_translation, subdeck_translation FROM deck_translations WHERE lang_name = 'Spanish';"
      )
      .all();
    const translations = new Map<number, DeckTitleTranslation>(
      rows.map((r) => [
        r.deck_id,
        tr(r.theme_translation, r.deck_translation, r.subdeck_translation, r.subtheme_translation),
      ])
    );
    const labels = buildDeckLabels(catalog, translations);
    const byGroup = new Map<string, Set<string>>();
    for (const l of labels.values()) {
      if (!byGroup.has(l.deckKey)) byGroup.set(l.deckKey, new Set());
      byGroup.get(l.deckKey)!.add(l.deckName);
    }
    for (const names of byGroup.values()) expect(names.size).toBe(1);
  });
});
