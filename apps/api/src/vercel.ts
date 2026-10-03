import type { Request, Response } from 'express';
import app from './app.js';

export default function handler(request: Request, response: Response) {
  // Vercel pre-parses unsigned cookies, even when the header is empty. Let
  // cookie-parser read the original header and verify signed cookies itself.
  Object.defineProperty(request, 'cookies', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: undefined,
  });

  // Vercel supplies this parameter when routing /api/* to this single function.
  const url = new URL(request.url, 'http://localhost');
  const route = request.query?.__cloudsent_path ?? url.searchParams.get('__cloudsent_path');
  url.searchParams.delete('__cloudsent_path');
  if (typeof route === 'string') {
    const search = url.searchParams.toString();
    request.url = `/api/${route}${search ? `?${search}` : ''}`;
  }
  return app(request, response);
}
