import { describe, expect, it } from 'vitest';
import { isSameOriginMutation } from './csrf';

describe('same-origin request protection', () => {
  it('allows mutation requests with a same-origin Origin header', () => {
    expect(isSameOriginMutation('POST', 'https://watchflow.example/api', 'https://watchflow.example', null)).toBe(true);
  });

  it('allows same-origin Referer when Origin is absent', () => {
    expect(isSameOriginMutation('POST', 'https://watchflow.example/api', null, 'https://watchflow.example/login')).toBe(true);
  });

  it('rejects cross-origin, malformed, and headerless mutations', () => {
    expect(isSameOriginMutation('POST', 'https://watchflow.example/api', 'https://evil.example', null)).toBe(false);
    expect(isSameOriginMutation('POST', 'https://watchflow.example/api', 'not a URL', null)).toBe(false);
    expect(isSameOriginMutation('POST', 'https://watchflow.example/api', null, null)).toBe(false);
  });

  it('does not require origin validation for safe methods', () => {
    expect(isSameOriginMutation('GET', 'https://watchflow.example/api', null, null)).toBe(true);
  });
});
