import { RARITY_INFO, rarity_of } from '../birds/bird.generator';
import { breed_birds } from '../birds/birds';
import { age_bird, can_breed_bird } from '../birds/birds.age';
import { fade_joy } from '../birds/birds.joy';
import { NO_NOTICE_ACTION, push_notice } from '../notices/notices';
import { offline_since, request_save, write_game } from '../save/save';
import { shuffle_in_place } from '../../utils/random';
import { CONFIG } from '../../../config';

const MIN_MS = CONFIG.idle.min_ms;
const BREED_MS = CONFIG.idle.breed_ms;
const BREED_RARITY_FACTOR = CONFIG.idle.breed_rarity_factor;

const TITLE = CONFIG.theme.text;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const duration_text = (ms: number) => {
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);

  return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const breed_factor = (bird: BIRD.Bird) => BREED_RARITY_FACTOR[rarity_of(bird.behaviour.genes)];

const idle_breed = (engine: BIRD.EngineContext, game: BIRD.GameState, ms: number) => {
  const time_chance = 1 - Math.exp(-ms / BREED_MS);
  const ready = game.birds.filter(can_breed_bird);

  shuffle_in_place(ready, ready.length, Math.random);

  for (let i = 0; i + 1 < ready.length; i += 2) {
    const a = ready[i]!;
    const b = ready[i + 1]!;

    if (Math.random() < time_chance * breed_factor(a) * breed_factor(b)) {
      const chick = breed_birds(engine, game, a, b);

      return chick === null ? null : { chick, a, b };
    }
  }

  return null;
};

export const pass_idle_time = (engine: BIRD.EngineContext, game: BIRD.GameState, ms: number) => {
  for (const bird of game.birds) {
    age_bird(bird, ms);
    fade_joy(bird, ms);
  }

  request_save(game);

  if (ms < MIN_MS) {
    return;
  }

  push_notice(
    game,
    'welcome',
    'Welcome back!',
    `You were away for ${duration_text(ms)}`,
    TITLE,
    NO_NOTICE_ACTION,
  );

  const bred = idle_breed(engine, game, ms);

  if (bred !== null) {
    const { chick, a, b } = bred;

    const rarity = rarity_of(chick.behaviour.genes);

    push_notice(
      game,
      null,
      'A chick hatched!',
      `${a.name} and ${b.name} had a chick - meet ${chick.name}`,
      rarity === 'common' ? TITLE : RARITY_INFO[rarity].color,
      { kind: 'hatch', bird: chick },
    );
  }
};

export const watch_page_visibility = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  let hidden_at = -1;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hidden_at = Date.now();
      write_game(game);
    } else if (hidden_at !== -1) {
      const offline = offline_since(hidden_at);

      hidden_at = -1;
      pass_idle_time(engine, game, offline);
    }
  });
};
