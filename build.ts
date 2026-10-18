import { build as bun_build, fileURLToPath, Glob, spawnSync } from 'bun';
import { cp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { basename, join } from 'path';

export const OUTDIR = 'docs';
const ENTRY = join('src', 'index.html');
const WORKERS = 'src/**/*.worker.ts';
const WORKER_SUFFIX = '.worker.ts';
const DEV_FEATURES = ['DEV'];

const PWA_DIR = join('src', 'pwa');
const PWA_HEAD = [
  '<link rel="manifest" href="manifest.webmanifest" />',
  '<link rel="icon" type="image/png" href="icon-192.png" />',
  '<link rel="apple-touch-icon" href="icon-180.png" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="Birds" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  '<meta name="theme-color" content="#000000" />',
].join('');

const SERVICE_WORKER = join('src', 'service_worker.ts');
const SERVICE_WORKER_OUT = 'sw.js';
const SW_REGISTER = `<script>navigator.serviceWorker?.register('${SERVICE_WORKER_OUT}')</script>`;
const SW_UNREGISTER =
  '<script>navigator.serviceWorker?.getRegistrations().then(async list => {' +
  'for (const r of list) await r.unregister();' +
  'for (const key of await caches.keys()) await caches.delete(key);' +
  'if (navigator.serviceWorker.controller) location.reload();' +
  '})</script>';
const SW_KILL =
  "self.addEventListener('install', () => self.skipWaiting());" +
  "self.addEventListener('activate', event => event.waitUntil((async () => {" +
  'for (const key of await caches.keys()) await caches.delete(key);' +
  'await self.registration.unregister();' +
  "for (const client of await self.clients.matchAll({ type: 'window' }))" +
  ' client.navigate(client.url);' +
  '})()));';

const escape_script = (js: string) => js.replaceAll('</script', '<\\/script');

const HTML_COMMENT = /[ \t]*<!--[\s\S]*?-->[ \t]*\n?/g;
const CSS_COMMENT = /[ \t]*\/\*[\s\S]*?\*\/[ \t]*\n?/g;
const STYLE_BLOCK = /<style[^>]*>[\s\S]*?<\/style>/g;

const strip_comments = (html: string) =>
  html.replace(HTML_COMMENT, '').replace(STYLE_BLOCK, style => style.replace(CSS_COMMENT, ''));

const VERSION_TAG = /<div id="version"><\/div>/;

// const git_output = (args: string[]) => {
//   const git = spawnSync(['git', ...args]);

//   if (git.exitCode !== 0) {
//     throw new Error(`git ${args[0]} failed: ${git.stderr.toString().trim()}`);
//   }

//   return git.stdout.toString().trim();
// };

const build_version = () => 'v1.0';

const fail = (logs: readonly unknown[]) => {
  for (const log of logs) {
    console.error(log);
  }

  throw new Error('build failed');
};

const build_workers = async (dev: boolean) => {
  const paths = [...new Glob(WORKERS).scanSync('.')].sort();
  const tags: string[] = [];

  for (const path of paths) {
    const result = await bun_build({
      entrypoints: [path],
      target: 'browser',
      format: 'esm',
      minify: !dev,
      features: dev ? DEV_FEATURES : [],
    });

    if (!result.success) {
      fail(result.logs);
    }

    const code = escape_script((await result.outputs[0]!.text()).trim());

    tags.push(
      `<script type="text/worker" data-worker="${basename(path, WORKER_SUFFIX)}">${code}</script>`,
    );
  }

  return tags.join('');
};

const build_service_worker = async () => {
  const result = await bun_build({
    entrypoints: [SERVICE_WORKER],
    target: 'browser',
    minify: true,
  });

  if (!result.success) {
    fail(result.logs);
  }

  await writeFile(join(OUTDIR, SERVICE_WORKER_OUT), await result.outputs[0]!.text());
};

export const build = async (dev = false) => {
  await rm(OUTDIR, { recursive: true, force: true });
  await mkdir(OUTDIR, { recursive: true });

  const result = await bun_build({
    entrypoints: [ENTRY],
    outdir: OUTDIR,
    target: 'browser',
    minify: !dev,
    features: dev ? DEV_FEATURES : [],
    naming: { asset: '[name].[ext]' },
  });

  if (!result.success) {
    fail(result.logs);
  }

  const js = result.outputs.find(output => output.path.endsWith('.js'));
  const css = result.outputs.find(output => output.path.endsWith('.css'));

  if (!js) {
    throw new Error('no js output');
  }

  const html_path = join(OUTDIR, 'index.html');
  let html = await readFile(html_path, 'utf8');

  if (!dev) {
    html = strip_comments(html);
  }

  if (css) {
    const style = (await css.text()).trim();

    html = html.replace(/<link[^>]*rel="stylesheet"[^>]*>/, () => `<style>${style}</style>`);
  }

  if (!dev) {
    if (!VERSION_TAG.test(html)) {
      throw new Error('no #version element in index.html');
    }

    html = html.replace(VERSION_TAG, () => `<div id="version">${build_version()}</div>`);
  }

  html = html.replace('</head>', () => `${PWA_HEAD}${dev ? SW_UNREGISTER : SW_REGISTER}</head>`);

  const script = escape_script((await js.text()).trim());
  const workers = await build_workers(dev);

  html = html.replace(
    /<script[^>]*src="[^"]+\.js"[^>]*><\/script>/,
    () => `${workers}<script type="module">${script}</script>`,
  );

  await writeFile(html_path, html);

  await rm(js.path, { force: true });

  if (css) {
    await rm(css.path, { force: true });
  }

  await writeFile(join(OUTDIR, '.nojekyll'), '');
  await cp(PWA_DIR, OUTDIR, { recursive: true });

  if (dev) {
    await writeFile(join(OUTDIR, SERVICE_WORKER_OUT), SW_KILL);
  } else {
    await build_service_worker();
  }

  return result;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await build();
}
