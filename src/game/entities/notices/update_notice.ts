import { feature } from 'bun:bundle';
import { check_app_update } from '../../../engine/app_update';
import { push_notice } from './notices';
import { CONFIG } from '../../../config';

const TITLE = CONFIG.theme.text;

export const watch_app_update = (game: BIRD.GameState) => {
  if (!feature('DEV')) {
    void check_app_update().then(ready => {
      if (ready) {
        push_notice(game, 'update', 'Update ready', 'Tap to restart with the new version', TITLE, {
          kind: 'restart',
        });
      }
    });
  }
};
