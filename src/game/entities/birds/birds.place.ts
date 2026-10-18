import { MIN_SPACING, type Spot } from '../platforms/platforms';

export const stand_x = (bird: BIRD.Bird) => (bird.flight ? bird.flight.to_x : bird.x);

export const stand_y = (bird: BIRD.Bird) => (bird.flight ? bird.flight.to_y : bird.y);

export const stand_platform = (bird: BIRD.Bird) =>
  bird.flight ? bird.flight.to_platform : bird.platform;

const taken: Spot[] = [];
const spot_pool: Spot[] = [];

const push_taken = (platform: number, x: number) => {
  let spot = spot_pool[taken.length];

  if (spot === undefined) {
    spot = { platform, x };
    spot_pool.push(spot);
  } else {
    spot.platform = platform;
    spot.x = x;
  }

  taken.push(spot);
};

export const taken_spots = (
  birds: readonly BIRD.Bird[],
  except: BIRD.Bird | null,
): readonly Spot[] => {
  taken.length = 0;

  for (const other of birds) {
    if (other === except || other.playing || other.bathing) {
      continue;
    }

    push_taken(stand_platform(other), stand_x(other));

    if (other.walk_target !== null) {
      const from = Math.min(other.x, other.walk_target);
      const to = Math.max(other.x, other.walk_target);

      for (let x = from; x < to; x += MIN_SPACING / 2) {
        push_taken(other.platform, x);
      }

      push_taken(other.platform, to);
    }
  }

  return taken;
};
