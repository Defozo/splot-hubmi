import { httpAction, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';

export const uploadUrl = internalMutation({ args: {}, handler: ctx => ctx.storage.generateUploadUrl() });
export const publish = internalMutation({ args: { files: v.array(v.object({ path: v.string(), storageId: v.id('_storage'), contentType: v.string() })), build: v.string() }, handler: async (ctx, args) => {
  if (process.env.APP_ENV !== 'demo' || process.env.APP_PROJECT !== 'splot-hubmi') throw new Error('Static publishing is scoped to Splot demo.');
  if (!args.files.some(file => file.path === '/index.html')) throw new Error('Missing application entrypoint.');
  for (const file of args.files) if (!file.path.startsWith('/') || file.path.includes('..') || file.path.includes('\\')) throw new Error('Invalid asset path.');
  const previous = await ctx.db.query('meta').withIndex('by_key', q => q.eq('key', 'staticSite')).unique();
  const value = { files: args.files, build: args.build, publishedAt: Date.now(), previousFiles: (previous?.value.files || []).filter((file: any) => file.path.startsWith('/assets/')) };
  if (previous) await ctx.db.patch(previous._id, { value }); else await ctx.db.insert('meta', { key: 'staticSite', value });
  return { files: args.files.length, build: args.build };
} });
export const resolve = internalQuery({ args: { path: v.string() }, handler: async (ctx, args) => {
  const manifest = await ctx.db.query('meta').withIndex('by_key', q => q.eq('key', 'staticSite')).unique();
  if (!manifest) return null;
  const path = args.path === '/' ? '/index.html' : args.path;
  const file = [...manifest.value.files, ...(manifest.value.previousFiles || [])].find((entry: any) => entry.path === path);
  if (!file) return null;
  return { url: await ctx.storage.getUrl(file.storageId), contentType: file.contentType, build: manifest.value.build, cache: path.startsWith('/assets/') };
} });
export const serveStatic = httpAction(async (ctx, request) => {
  const pathname = new URL(request.url).pathname;
  const file: any = await ctx.runQuery(internal.staticSite.resolve, { path: pathname });
  if (!file?.url) return new Response('Nie znaleziono strony.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  // These archives are explicitly published in the public static manifest.
  // Direct storage downloads avoid the HTTP action's 20 MiB response limit.
  if (pathname.startsWith('/materialy/') && file.contentType === 'application/zip') {
    return new Response(null, { status: 307, headers: {
      Location: file.url, 'Cache-Control': 'no-store', 'X-Splot-Build': file.build,
      'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow',
    } });
  }
  const range = request.headers.get('range');
  const content = await fetch(file.url, { headers: range ? { Range: range } : {} });
  return new Response(content.body, { status: content.status, headers: {
    'Content-Type': file.contentType,
    'Cache-Control': file.cache ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Robots-Tag': 'noindex, nofollow', 'X-Splot-Build': file.build,
    ...(content.headers.get('content-range') ? { 'Content-Range': content.headers.get('content-range')! } : {}),
    ...(content.headers.get('content-length') ? { 'Content-Length': content.headers.get('content-length')! } : {}),
    'Accept-Ranges': 'bytes',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self'; connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site; media-src 'self' blob: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'",
  } });
});
