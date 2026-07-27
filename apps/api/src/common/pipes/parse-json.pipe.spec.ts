import { BadRequestException } from '@nestjs/common';
import { ParseJsonPipe } from './parse-json.pipe';

describe('ParseJsonPipe', () => {
  let pipe: ParseJsonPipe;

  beforeEach(() => {
    pipe = new ParseJsonPipe();
  });

  it('should pass through objects unchanged', () => {
    const obj = { projectName: 'Test Project' };
    expect(pipe.transform(obj, { type: 'body', data: 'payload' })).toEqual(obj);
  });

  it('should parse valid JSON string to an object', () => {
    const jsonString = '{"projectName":"Test Project","suiteName":"Suite 1"}';
    expect(
      pipe.transform(jsonString, { type: 'body', data: 'payload' }),
    ).toEqual({
      projectName: 'Test Project',
      suiteName: 'Suite 1',
    });
  });

  it('should throw BadRequestException when given invalid JSON string', () => {
    const invalidJson = '{projectName: invalid}';
    expect(() =>
      pipe.transform(invalidJson, { type: 'body', data: 'payload' }),
    ).toThrow(BadRequestException);
  });

  it('should throw BadRequestException when given null or empty input', () => {
    expect(() => pipe.transform('', { type: 'body', data: 'payload' })).toThrow(
      BadRequestException,
    );
  });
});
