import { layer_clock, mark_layer } from '../../entities/debug_hud/debug_hud';
import { render_bird_hover } from '../../entities/birds/birds.hover.renderer';
import { render_birds } from '../../entities/birds/birds.renderer';
import { render_spray } from '../../entities/birds/birds.bath.renderer';
import { render_trails } from '../../entities/birds/birds.trail.renderer';
import { render_background } from '../../entities/misc/background.renderer';
import { render_platforms_debug } from '../../entities/platforms/platforms.renderer';
import { render_clouds } from '../../entities/sky/clouds.renderer';
import { render_sky } from '../../entities/sky/sky.renderer';
import { render_tree } from '../../entities/tree/tree.renderer';
import { render_day_panel } from '../../entities/ui/day_panel';
import { render_view_panel } from '../../entities/ui/view_panel';

export const render_primary_scene = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.PrimaryScene,
) => {
  const hud = game.debug_hud;
  let t = layer_clock(game);

  render_sky(engine, scene);
  t = mark_layer(hud, 'sky', t);
  render_clouds(engine, scene);
  t = mark_layer(hud, 'clouds', t);
  render_tree(engine, game, scene);
  t = mark_layer(hud, 'tree', t);
  render_background(engine, scene);
  t = mark_layer(hud, 'ground', t);
  render_trails(engine, scene.camera);
  render_birds(engine, game, scene.camera);
  render_spray(engine, scene.camera);
  t = mark_layer(hud, 'birds', t);
  render_bird_hover(engine, scene.bird_hover, scene.camera);
  t = mark_layer(hud, 'hover', t);
  render_day_panel(engine, game);
  render_view_panel(engine, game);
  mark_layer(hud, 'panels', t);
};

export const render_primary_debug = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.PrimaryScene,
) => {
  render_platforms_debug(engine, game, scene);
};
