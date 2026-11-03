# VocabuLab

VocabuLab is a mobile app for learning vocabulary with spaced repetition. You pick the language you speak and the one you're learning, choose topics, and review flashcards on a schedule set by the FSRS algorithm. It works fully offline: the word database ships with the app and your progress stays on your phone.

Lex, a young scientist, is the app's mascot. He lives in a small lab that you decorate with furniture bought with Sparks, which you earn by reviewing cards. He studies when cards are due, relaxes when you're done, and celebrates after a session.

## Who it's for

People learning a new language who want short daily reviews on their phone, without an account or an internet connection.

## Features

- **Spaced repetition with FSRS** (via `ts-fsrs`): Again / Hard / Good / Easy grading, with the next review scheduled automatically.
- **Large offline word library**: about 30,000 cards in roughly 270 topics, organized as theme › deck › subdeck and graded from Level 1 to Level 6.
- **Many languages**: 120+ language pairs for the cards, and the interface is translated into the same set of languages.
- **Onboarding**: choose your language pair, starting level, and learn how grading works.
- **Lex's lab**: a decoratable room on a 4×6 grid, drag-and-drop arrange mode, a furniture shop paid with Sparks, and trophy items unlocked by study milestones.
- **Progress screen**: streaks, review history and mastery.
- **Free to use**: optional rewarded ads to earn extra word allowance, and an optional ad-free pass.

## Built with

- [Expo](https://expo.dev) SDK 57, React Native 0.86, React 19, TypeScript
- `expo-sqlite` (WAL + FTS5) for the word database and the user's progress
- `ts-fsrs` for scheduling
- `react-native-svg` and React Native's `Animated` API for Lex and the lab furniture
- `i18next` / `react-i18next` for translations
- `react-native-google-mobile-ads` (rewarded ads) and `react-native-iap` (ad-free pass)
- Jest + React Native Testing Library, ESLint, Prettier

## Running it

You need Node.js 22 (see `.nvmrc`) and either Android Studio (Android) or Xcode on a Mac (iOS).

```bash
git clone https://github.com/martini-code/VocabuLab.git
cd VocabuLab
npm install

# The app uses native modules (SQLite, ads, in-app purchases), so it needs a
# development build rather than Expo Go:
npx expo run:android          # Android device or emulator
npx expo run:ios --device     # iPhone (on a Mac with Xcode)
```

### Local configuration

Real AdMob unit IDs and store product IDs are kept out of the repository. The app runs with Google's public test ad IDs by default. To use your own values:

```bash
cp src/config/secrets.example.ts src/config/secrets.local.ts
# then edit secrets.local.ts (it is ignored by Git)
```

## Checks

```bash
npm run lint          # ESLint
npm run format:check  # Prettier
npm run typecheck     # TypeScript
npm test              # Jest unit and component tests
npm run test:fsrs     # FSRS scheduling checks
npm run i18n:check    # every locale has every translation key
```

The same checks run in GitHub Actions on every pull request and on pushes to `main`.

## Project layout

```
App.tsx                 app shell, tabs and navigation
src/features/pipeline   review session and card flipper
src/features/decks      topic and level browser
src/features/onboarding first-run setup
src/features/lab        Lex's lab: room, furniture, arrange mode, shop
src/features/progress   progress and streaks
src/db                  SQLite access (word database and user data)
src/srs                 spaced-repetition algorithms
src/components          shared UI (mascot, buttons, modals)
src/locales             translations
src/theme               colors, levels and design tokens
```

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## License

[MIT](LICENSE) © 2026 Gabriel Martini
