import { watch } from 'fs';
import { join } from 'path';

import { build } from './build';

const rebuild = async () => {
  const start = performance.now();

  try {
    await build(true);

    console.log('[watch] build ok', (performance.now() - start) | 0, 'ms');
  } catch (error) {
    console.error('[watch] build failed', (performance.now() - start) | 0, 'ms');

    console.error(error);
  }
};

await rebuild();

watch(join(import.meta.dir, 'src'), { recursive: true }, () => {
  void rebuild();
});

await import('./serve');
