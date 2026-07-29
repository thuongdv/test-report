import { SkillError } from './types';

describe('SkillError', () => {
  it('should include skill name in message', () => {
    const error = new SkillError('git-diff', 'Something went wrong');
    expect(error.message).toBe('[git-diff] Something went wrong');
    expect(error.skillName).toBe('git-diff');
    expect(error.name).toBe('SkillError');
  });

  it('should preserve the cause', () => {
    const cause = new Error('Original error');
    const error = new SkillError('jest-runner', 'Test failed', cause);
    expect(error.cause).toBe(cause);
  });

  it('should be an instance of Error', () => {
    const error = new SkillError('test-skill', 'msg');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SkillError);
  });
});
