import { registerHooks } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const src = path.resolve(fileURLToPath(import.meta.url), '../../src');
const tryExt = (p) => ['', '.ts', '.tsx', '/index.ts'].map((e) => p + e).find((f) => existsSync(f) && statSync(f).isFile());

registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) {
      const target = tryExt(path.join(src, spec.slice(2)));
      if (target) return next(pathToFileURL(target).href, ctx);
    }
    if (spec.startsWith('.') && ctx.parentURL?.startsWith('file:') && !ctx.parentURL.includes('/node_modules/')) {
      const target = tryExt(path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec));
      if (target) return next(pathToFileURL(target).href, ctx);
    }
    return next(spec, ctx);
  },
});
