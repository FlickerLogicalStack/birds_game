import { update_bird_flight } from '../../entities/birds/birds.flight';
import { update_plays } from '../../entities/birds/birds.play';
import { update_baths } from '../../entities/birds/birds.bath';
import { update_trails } from '../../entities/birds/birds.trail';
import { update_auto_follow } from '../../entities/camera/camera.auto_follow';
import { update_bird_walk } from '../../entities/birds/birds.walk';
import { update_clouds } from '../../entities/sky/clouds';
import { update_day_cycle } from '../../entities/sky/sky';

export const handle_primary_gameplay = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.PrimaryScene,
) => {
  update_auto_follow(
    scene.auto_follow,
    scene.camera_follow,
    scene.camera,
    game.birds,
    engine.delta,
  );
  update_day_cycle(scene.day, engine.delta);
  update_clouds(scene.clouds, engine.delta);

  update_plays(engine, game, scene);
  update_baths(engine, game, scene);
  update_trails(engine, game, scene);

  for (const bird of game.birds) {
    if (bird.playing || bird.bathing) {
      continue;
    }

    if (!update_bird_flight(engine, game, scene, bird)) {
      update_bird_walk(engine, game, scene, bird);
    }
  }
};
