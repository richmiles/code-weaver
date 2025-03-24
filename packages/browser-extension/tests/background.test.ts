import { isMyMessage } from '../src/background/index';

describe('isMyMessage', () => {
  it('returns true for a valid HELLO message', () => {
    const validMessage = { type: 'HELLO', from: 'test' };
    expect(isMyMessage(validMessage)).toBe(true);
  });

  it('returns false for a message with an invalid type', () => {
    const invalidMessage = { type: 'INVALID' };
    expect(isMyMessage(invalidMessage)).toBe(false);
  });

  it('returns false for non-object inputs', () => {
    expect(isMyMessage(null)).toBe(false);
    expect(isMyMessage(42)).toBe(false);
  });
});
