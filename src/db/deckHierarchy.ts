import { DeckGroup, DeckWithProgress, ThemeGroup } from '../types';

/**
 * The lexicon organizes vocabulary as Theme › (Subtheme) › Deck › Subdeck.
 * Each row of the static `decks` table is one leaf subdeck that owns cards;
 * a deck is the set of rows sharing (theme, subtheme, deck).
 */
export interface DeckRow {
  deck_id: number;
  theme: string;
  subtheme: string | null;
  deck: string;
  subdeck: string | null;
  difficulty: number;
}

/** Translated titles for one deck row (any field may be empty). */
export interface DeckTitleTranslation {
  theme: string;
  subtheme: string;
  deck: string;
  subdeck: string;
}

export interface DeckLabels {
  themeKey: string;
  themeName: string;
  subthemeKey: string;
  subthemeName: string;
  deckKey: string;
  deckName: string;
  subdeckName: string;
  /** True when the deck is split into more than one subdeck. */
  hasSubdecks: boolean;
  /** Name inside the theme list: the subdeck name for split decks, else the deck name. */
  displayName: string;
  /** Name outside the hierarchy, e.g. "Insects › Beetles". */
  fullName: string;
  /** For unsplit decks whose only subdeck has its own name, e.g. "Traits" under "Pets". */
  subtitle?: string;
}

export const SUBDECK_SEPARATOR = ' › ';

export function capitalizeTitle(text: string): string {
  if (!text) return '';
  return text
    .split(' ')
    .map((word) => {
      if (word.startsWith('(')) {
        return '(' + word.charAt(1).toUpperCase() + word.slice(2);
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

const norm = (s: string | null | undefined) => (s || '').trim().toLowerCase();

export const deckGroupKey = (row: Pick<DeckRow, 'theme' | 'subtheme' | 'deck'>) =>
  `${norm(row.theme)}|${norm(row.subtheme)}|${norm(row.deck)}`;

const isMainSubdeck = (row: DeckRow) => !norm(row.subdeck) || norm(row.subdeck) === norm(row.deck);

/** Most frequent non-empty value, ties broken by first occurrence. */
function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  let best = '';
  let bestCount = 0;
  for (const v of values) {
    if (!v) continue;
    const n = (counts.get(v) || 0) + 1;
    counts.set(v, n);
    if (n > bestCount) {
      best = v;
      bestCount = n;
    }
  }
  return best;
}

/**
 * Builds a deck_id → labels lookup. Deck-level and theme-level names are agreed per
 * group, so subdecks of one deck never disagree on their parent's name even when
 * individual translation rows do.
 */
export function buildDeckLabels(
  rows: DeckRow[],
  translations: Map<number, DeckTitleTranslation>
): Map<number, DeckLabels> {
  const byDeck = new Map<string, DeckRow[]>();
  const byTheme = new Map<string, DeckRow[]>();
  const bySubtheme = new Map<string, DeckRow[]>();
  for (const r of rows) {
    const dk = deckGroupKey(r);
    if (!byDeck.has(dk)) byDeck.set(dk, []);
    byDeck.get(dk)!.push(r);
    const tk = norm(r.theme);
    if (!byTheme.has(tk)) byTheme.set(tk, []);
    byTheme.get(tk)!.push(r);
    const sk = `${tk}|${norm(r.subtheme)}`;
    if (!bySubtheme.has(sk)) bySubtheme.set(sk, []);
    bySubtheme.get(sk)!.push(r);
  }

  const tr = (r: DeckRow) => translations.get(r.deck_id);

  const themeNames = new Map<string, string>();
  for (const [k, group] of byTheme) {
    themeNames.set(
      k,
      mostCommon(group.map((r) => (tr(r)?.theme || '').trim())) || capitalizeTitle(group[0].theme)
    );
  }

  const subthemeNames = new Map<string, string>();
  for (const [k, group] of bySubtheme) {
    if (!norm(group[0].subtheme)) {
      subthemeNames.set(k, '');
      continue;
    }
    subthemeNames.set(
      k,
      mostCommon(group.map((r) => (tr(r)?.subtheme || '').trim())) ||
        capitalizeTitle(group[0].subtheme || '')
    );
  }

  const deckNames = new Map<string, string>();
  for (const [k, group] of byDeck) {
    // The subdeck named after its deck carries the most reliable deck translation.
    const main = group.find(isMainSubdeck);
    const fromMain = main ? (tr(main)?.deck || '').trim() : '';
    deckNames.set(
      k,
      fromMain ||
        mostCommon(group.map((r) => (tr(r)?.deck || '').trim())) ||
        capitalizeTitle(group[0].deck)
    );
  }

  const result = new Map<number, DeckLabels>();
  for (const r of rows) {
    const dk = deckGroupKey(r);
    const group = byDeck.get(dk)!;
    const hasSubdecks = group.length > 1;
    const deckName = capitalizeTitle(deckNames.get(dk)!);
    const subdeckName =
      capitalizeTitle((tr(r)?.subdeck || '').trim()) || capitalizeTitle(r.subdeck || r.deck);
    const themeKey = norm(r.theme);
    const subthemeKey = norm(r.subtheme);
    // "Pets" › "Traits" earns a subtitle; "Family Members" › "Members" does not.
    const subtitle =
      !hasSubdecks &&
      !isMainSubdeck(r) &&
      !deckName.toLowerCase().includes(subdeckName.toLowerCase())
        ? subdeckName
        : undefined;

    result.set(r.deck_id, {
      themeKey,
      themeName: capitalizeTitle(themeNames.get(themeKey)!),
      subthemeKey,
      subthemeName: capitalizeTitle(subthemeNames.get(`${themeKey}|${subthemeKey}`) || ''),
      deckKey: dk,
      deckName,
      subdeckName,
      hasSubdecks,
      displayName: hasSubdecks ? subdeckName : deckName,
      fullName: hasSubdecks ? `${deckName}${SUBDECK_SEPARATOR}${subdeckName}` : deckName,
      subtitle,
    });
  }
  return result;
}

// ─── Icons ──────────────────────────────────────────────────────────────────

export const CATEGORY_ICONS: Record<string, string> = {
  greetings: 'handshake',
  basics: 'message-circle',
  family: 'users',
  numbers: 'coins',
  animals: 'paw-print',
  vehicles: 'car',
  transit: 'car',
  math: 'calculator',
  electronics: 'cpu',
  biology: 'dna',
  home: 'home',
  construction: 'hammer',
  food: 'apple',
  sports: 'trophy',
  travel: 'luggage',
  dining: 'utensils',
  health: 'stethoscope',
  'human anatomy': 'activity',
  colors: 'palette',
  art: 'palette',
  military: 'award',
};

export const SUBCATEGORY_ICONS: Record<string, string> = {
  'domestic animals': 'dog',
  insects: 'bug',
  beetles: 'bug',
  arachnids: 'bug',
  'farm animals': 'paw-print',
  pets: 'cat',
  'air vehicles': 'plane',
  'land vehicles': 'car',
  'water vehicles': 'ship',
  vehicles: 'car',
  'city infrastructure': 'landmark',
  furniture: 'armchair',
  'home spaces': 'home',
  'hand tools': 'hammer',
  'power tools': 'wrench',
  'building materials': 'layers',
  fruits: 'apple',
  spices: 'flame',
  'basic groceries': 'shopping-bag',
  'core team sports': 'trophy',
  'individual sports': 'activity',
  'sport venues': 'landmark',
  basketball: 'trophy',
  'cell cycle': 'microscope',
  'basic math operations': 'divide',
  'number properties': 'percent',
  'electronic components': 'cpu',
  'house appliances': 'tv',
  'formal greetings': 'handshake',
  'casual greetings': 'message-square',
  'formal farewells': 'handshake',
  'casual farewells': 'message-circle',
  'family members': 'users',
  limbs: 'activity',
  muscles: 'activity',
  'primary colors': 'palette',
  'secondary colors': 'palette',
  'metallic hues': 'sparkles',
  'military ranks': 'award',
  'military officer ranks': 'medal',
};

/** Icon for a theme (one argument) or a deck/subdeck (most specific name first). */
export function resolveDeckIcon(theme?: string, ...names: (string | null | undefined)[]): string {
  for (let i = names.length - 1; i >= 0; i--) {
    const key = norm(names[i]);
    if (key && SUBCATEGORY_ICONS[key]) return SUBCATEGORY_ICONS[key];
  }
  return CATEGORY_ICONS[norm(theme)] || 'book-open';
}

// ─── Theme grouping ─────────────────────────────────────────────────────────

/** Preferred theme order for beginners; themes not listed follow alphabetically. */
export const THEME_ORDER = [
  'basics',
  'greetings',
  'family',
  'numbers',
  'colors',
  'animals',
  'food',
  'home',
];

/**
 * Groups leaf subdecks (already in display order) into Theme › Deck › Subdeck.
 * Deck groups keep the order of their first subdeck; the subdeck named after
 * its deck comes first within a group.
 */
export function groupDecksIntoThemes(leaves: DeckWithProgress[]): ThemeGroup[] {
  const themes = new Map<string, ThemeGroup>();
  const groups = new Map<string, DeckGroup>();

  for (const leaf of leaves) {
    const themeKey = leaf.theme_id;
    if (!themes.has(themeKey)) {
      themes.set(themeKey, {
        id: `theme_${themeKey}`,
        name: leaf.theme_name || capitalizeTitle(themeKey),
        description: '',
        icon_name: resolveDeckIcon(themeKey),
        is_pro: false,
        decks: [],
        deck_groups: [],
      });
    }
    const theme = themes.get(themeKey)!;
    theme.decks.push(leaf);

    const groupKey = leaf.deck_key || leaf.id;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        id: `deck_${groupKey}`,
        name: leaf.deck_name || leaf.name,
        subtheme_name: leaf.subtheme_name || undefined,
        icon_name: leaf.deck_icon_name || leaf.icon_name,
        subdecks: [],
        card_count: 0,
        queued_count: 0,
        mastered_count: 0,
        is_locked: true,
      };
      groups.set(groupKey, group);
      theme.deck_groups.push(group);
    }
    group.subdecks.push(leaf);
    group.card_count += leaf.card_count;
    group.queued_count += leaf.queued_count;
    group.mastered_count += leaf.mastered_count;
    group.is_locked = group.is_locked && Boolean(leaf.is_locked);
  }

  for (const group of groups.values()) {
    group.subdecks.sort(
      (a, b) => Number(Boolean(b.is_main_subdeck)) - Number(Boolean(a.is_main_subdeck))
    );
  }

  for (const theme of themes.values()) {
    // Keep decks of the same subtheme together, in first-seen order.
    const subthemeOrder = new Map<string, number>();
    theme.deck_groups.forEach((g) => {
      const k = g.subtheme_name || '';
      if (!subthemeOrder.has(k)) subthemeOrder.set(k, subthemeOrder.size);
    });
    theme.deck_groups = theme.deck_groups
      .map((g, i) => ({ g, i }))
      .sort(
        (a, b) =>
          subthemeOrder.get(a.g.subtheme_name || '')! -
            subthemeOrder.get(b.g.subtheme_name || '')! || a.i - b.i
      )
      .map(({ g }) => g);
  }

  const rank = (key: string) => {
    const i = THEME_ORDER.indexOf(key);
    return i === -1 ? THEME_ORDER.length : i;
  };
  return Array.from(themes.entries())
    .sort(([ka, a], [kb, b]) => rank(ka) - rank(kb) || a.name.localeCompare(b.name))
    .map(([, t]) => t);
}
