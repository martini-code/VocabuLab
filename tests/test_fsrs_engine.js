const assert = require('assert');
const { fsrs, Rating, State } = require('ts-fsrs');

// Simulated UserCard matching SQLite model
const sampleCard = {
  id: 'card_cili_007',
  front_lexeme_id: 1,
  back_lexeme_id: 2,
  due_date: new Date().toISOString(),
  state: 0,
  stability: 0,
  difficulty: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  reps: 0,
  lapses: 0,
  updated_at: new Date().toISOString(),
};

const f = fsrs();

// 1. Initial repetition for new card
const fsrsCard = {
  due: new Date(sampleCard.due_date),
  stability: sampleCard.stability,
  difficulty: sampleCard.difficulty,
  elapsed_days: sampleCard.elapsed_days,
  scheduled_days: sampleCard.scheduled_days,
  learning_steps: 0,
  reps: sampleCard.reps,
  lapses: sampleCard.lapses,
  state: sampleCard.state,
  last_review: new Date(sampleCard.updated_at),
};

const repeatResults = f.repeat(fsrsCard, new Date());

console.log('Testing FSRS Ratings:');
for (const r of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
  const result = repeatResults[r];
  assert(result, `Rating ${r} must produce a valid result`);
  assert(result.card.due instanceof Date, `Rating ${r} must compute a valid next due Date`);
  console.log(`- Rating ${r}: State=${result.card.state}, Stability=${result.card.stability.toFixed(2)}, Due=${result.card.due.toISOString()}`);
}

// 2. Test progression from Good -> Review State
const goodCard = repeatResults[Rating.Good].card;
const secondRepeat = f.repeat(goodCard, new Date(goodCard.due.getTime() + 1000 * 60));
assert(secondRepeat[Rating.Good].card.reps >= 2, 'Reps must increment on repeated reviews');

console.log('\nAll FSRS algorithm validations passed successfully!');
