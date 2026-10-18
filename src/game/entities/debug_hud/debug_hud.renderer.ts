import { text_cache_stats } from '../../utils/pixel_font';
import { ui_cache_stats } from '../../utils/ui_cache';
import { view_panel_right } from '../ui/view_panel';
import { CONFIG } from '../../../config';

const HUD_STEP = CONFIG.debug_hud.line_height;
const HUD_FONT = `${CONFIG.debug_hud.font_size}px monospace`;
const HUD_COLOR = CONFIG.theme.debug.hud;

export const render_debug_hud = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const ctx = engine.ctx;
  const hud = game.debug_hud;

  const fps_avg = hud.frames.avg();

  let cursor = 5;
  const x = 10 + view_panel_right(game);

  ctx.font = HUD_FONT;
  ctx.fillStyle = HUD_COLOR;

  const line = (value: string) => {
    cursor += HUD_STEP;
    ctx.fillText(value, x, cursor);
  };

  line(`frame: ${engine.frame}`);
  line(`fps: ${(fps_avg > 0 ? 1000 / fps_avg : 0).toFixed(1)}`);
  line(`frame time: ${hud.frame_times.avg().toFixed(2)} ms`);

  line(`scene: ${game.current_scene}`);
  switch (game.current_scene) {
    case 'primary': {
      let total = 0;

      for (const [name, ms] of hud.layers) {
        total += ms;
        line(`  ${name.padEnd(7)}${ms.toFixed(2).padStart(6)} ms`);
      }

      line(`  ${'total'.padEnd(7)}${total.toFixed(2).padStart(6)} ms`);
      break;
    }
  }

  line(`objects renders: ${hud.renders}`);
  line(`birds: ${game.birds.length}`);

  const warmer = engine.resources.bird_sprite_warmer;
  line(`sprites: ${warmer.cache.size}/${warmer.cache.max_entries}`);
  line(`atlas pages: ${warmer.atlas.page_count}`);
  line(`warm queue: ${warmer.pending}`);
  line(`bird cache: ${warmer.stored_hits} hit / ${warmer.stored_misses} drawn`);
  line(`idle tasks: ${game.idle.size}`);
  const { stable, volatile } = text_cache_stats;
  line(`text cache: ${stable.baked}/${stable.strings}, resets ${stable.resets}`);
  line(`volatile text: ${volatile.baked}/${volatile.strings}, resets ${volatile.resets}`);
  line(`ui cache redraws: ${ui_cache_stats.redraws}`);

  const workers = engine.resources.workers;
  const pool = workers.state === 'pool' ? `[${workers.loads.join(' ')}]` : workers.state;
  line(`workers: ${workers.count} ${pool}, busy ${workers.busy}`);
};
