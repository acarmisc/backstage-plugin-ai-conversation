import { isChatKeyAuthError } from './useThreads';

describe('isChatKeyAuthError', () => {
  it.each([
    'upstream 401: {"error":{"message":"Authentication Error"}}',
    'upstream 401: {"error":{"code":"token_not_found_in_db"}}',
    'Invalid proxy server token passed',
    'ExpiredToken: key has expired',
  ])('matches a rejected chat key: %s', msg => {
    expect(isChatKeyAuthError(msg)).toBe(true);
  });

  it.each([
    undefined,
    '',
    'upstream 500: internal error',
    'unauthenticated',
    'model "gpt-x" is not known to accept image attachments',
    'network error',
  ])('does not match unrelated failure: %s', msg => {
    expect(isChatKeyAuthError(msg as string | undefined)).toBe(false);
  });
});
