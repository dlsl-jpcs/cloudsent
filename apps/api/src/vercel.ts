import type { Request, Response } from 'express';
import app from './app.js';

export default function handler(request: Request, response: Response) {
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
