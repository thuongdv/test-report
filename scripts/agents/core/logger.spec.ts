import { Logger } from './logger';

describe('Logger', () => {
  let logger: Logger;
  let consoleSpy: {
    log: jest.SpiedFunction<typeof console.log>;
    warn: jest.SpiedFunction<typeof console.warn>;
    error: jest.SpiedFunction<typeof console.error>;
  };

  beforeEach(() => {
    logger = new Logger('TestAgent');
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log info messages with correct prefix', () => {
    logger.info('TestSkill', 'Processing...');
    expect(consoleSpy.log).toHaveBeenCalledTimes(1);
    const output = consoleSpy.log.mock.calls[0][0] as string;
    expect(output).toContain('[TestAgent]');
    expect(output).toContain('[TestSkill]');
    expect(output).toContain('[INFO]');
    expect(output).toContain('Processing...');
  });

  it('should log warning messages via console.warn', () => {
    logger.warn('TestSkill', 'Something fishy');
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    const output = consoleSpy.warn.mock.calls[0][0] as string;
    expect(output).toContain('[WARN]');
  });

  it('should log error messages via console.error', () => {
    logger.error('TestSkill', 'It broke');
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    const output = consoleSpy.error.mock.calls[0][0] as string;
    expect(output).toContain('[ERROR]');
  });

  it('should log success messages via console.log', () => {
    logger.success('TestSkill', 'Done!');
    expect(consoleSpy.log).toHaveBeenCalledTimes(1);
    const output = consoleSpy.log.mock.calls[0][0] as string;
    expect(output).toContain('[OK]');
  });

  it('should log agent-level messages without skill prefix', () => {
    logger.agent('Starting agent...');
    expect(consoleSpy.log).toHaveBeenCalledTimes(1);
    const output = consoleSpy.log.mock.calls[0][0] as string;
    expect(output).toContain('[TestAgent]');
    expect(output).toContain('Starting agent...');
    expect(output).not.toContain('[TestSkill]');
  });

  it('should include ISO timestamp in log output', () => {
    logger.info('TestSkill', 'Timestamped');
    const output = consoleSpy.log.mock.calls[0][0] as string;
    // ISO timestamp pattern: YYYY-MM-DDTHH:MM:SS.sssZ
    expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
  });
});
