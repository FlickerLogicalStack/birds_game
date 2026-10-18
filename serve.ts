import { file } from 'bun';
import { join, sep } from 'path';
import { OUTDIR } from './build';

const resolve_port = (): number => {
  const args = process.argv.slice(2);
  const flag_index = args.findIndex(arg => arg === '--port' || arg === '-p');

  if (flag_index !== -1 && args[flag_index + 1] !== undefined) {
    return Number(args[flag_index + 1]);
  }

  const positional = args.find(arg => /^\d+$/.test(arg));

  if (positional !== undefined) {
    return Number(positional);
  }

  return Number(process.env.PORT ?? 3000);
};

const requested_port = resolve_port();
const PORT = Number.isFinite(requested_port) && requested_port > 0 ? requested_port : 3000;
const ROOT = join(import.meta.dir, OUTDIR);

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'application/javascript',
  css: 'text/css',
  json: 'application/json',
  webmanifest: 'application/manifest+json',
  ico: 'image/x-icon',
  png: 'image/png',
  svg: 'image/svg+xml',
  txt: 'text/plain',
};

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);

    if (pathname.endsWith('/')) {
      pathname += 'index.html';
    }

    const file_path = join(ROOT, pathname);

    if (!file_path.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
      return new Response('Not Found', { status: 404 });
    }

    const entry = file(file_path);

    if (!(await entry.exists())) {
      return new Response('Not Found', { status: 404 });
    }

    const extension = pathname.split('.').pop()?.toLowerCase() ?? '';

    return new Response(entry, {
      headers: { 'Content-Type': MIME[extension] ?? 'application/octet-stream' },
    });
  },
});

console.log(`preview http://localhost:${server.port}`);
