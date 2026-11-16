/**
 * Request hardening without extra dependencies: per-IP token buckets and security headers (CSP in production).
 */
import { createHash } from 'node:crypto';
import type express from 'express';

/** Token bucket per client IP: `capacity` requests at once, refilled at `refillPerSecond`. */
export function rateLimit(opts: { name: string; capacity: number; refillPerSecond: number; maxClients?: number }) {
  const buckets = new Map<string, { tokens: number; at: number }>();
  const maxClients = opts.maxClients ?? 20_000;
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, b] of buckets) if (b.tokens + ((now - b.at) / 1000) * opts.refillPerSecond >= opts.capacity) buckets.delete(ip);
  }, 60_000);
  sweep.unref?.();
  const handler: express.RequestHandler = (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let b = buckets.get(ip);
    if (!b) {
      if (buckets.size >= maxClients) buckets.delete(buckets.keys().next().value!);
      b = { tokens: opts.capacity, at: now };
      buckets.set(ip, b);
    }
    b.tokens = Math.min(opts.capacity, b.tokens + ((now - b.at) / 1000) * opts.refillPerSecond);
    b.at = now;
    if (b.tokens < 1) {
      const retry = Math.ceil((1 - b.tokens) / opts.refillPerSecond);
      res.setHeader('Retry-After', String(retry));
      res.status(429).json({ error: `Too many requests (${opts.name}). Please retry in ${retry} s.` });
      return;
    }
    b.tokens -= 1;
    res.setHeader('RateLimit-Policy', `${opts.capacity};w=${Math.round(opts.capacity / opts.refillPerSecond)};name="${opts.name}"`);
    next();
  };
  return handler;
}

/** SHA-256 sources for every inline <script> in the given HTML (index.html theme bootstrap, standalone demo pages). */
export function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
}

/**
 * Content-Security-Policy for the production bundle. The browser only talks to this origin (all weather, market
 * and literature data are fetched server-side) plus Google Fonts for the stylesheet and font files. Inline scripts
 * are allowed only by hash, taken from the HTML files actually served (dist/*.html).
 */
export function buildCsp(htmlFiles: string[]): string {
  const hashes = [...new Set(htmlFiles.flatMap(inlineScriptHashes))];
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function securityHeaders(opts: { csp: string | null }): express.RequestHandler {
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    if (opts.csp) res.setHeader('Content-Security-Policy', opts.csp);
    next();
  };
}
