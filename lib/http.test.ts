import { describe, expect, it } from 'vitest';
import { readJsonResponseBody } from './http';

describe('HTTP response parsing', () => {
  it('parses empty and plain-text HTTP responses without crashing', async () => {
    const emptyResponse = new Response(null, { status: 200 });
    const invalidJsonResponse = new Response('Invalid credentials', {
      status: 401,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });

    await expect(readJsonResponseBody(emptyResponse)).resolves.toEqual({});
    await expect(readJsonResponseBody(invalidJsonResponse)).resolves.toEqual({ error: 'Invalid credentials' });
  });
});
