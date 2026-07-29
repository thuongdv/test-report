/**
 * Structured logger for agent execution tracing.
 *
 * Provides timestamped, prefixed log output for CI debugging.
 * Example: [2026-07-29T09:20:00.000Z][CodeReviewAgent][GitDiffSkill] Extracting diff...
 */

export class Logger {
  constructor(private readonly agentName: string) {}

  /** Log an informational message from a specific skill. */
  info(skill: string, message: string): void {
    this.write('INFO', skill, message);
  }

  /** Log a warning message. */
  warn(skill: string, message: string): void {
    this.write('WARN', skill, message);
  }

  /** Log an error message. */
  error(skill: string, message: string): void {
    this.write('ERROR', skill, message);
  }

  /** Log a success message. */
  success(skill: string, message: string): void {
    this.write('OK', skill, message);
  }

  /** Log at agent level (no skill context). */
  agent(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}][${this.agentName}] ${message}`);
  }

  private write(level: string, skill: string, message: string): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}][${this.agentName}][${skill}]`;
    const line = `${prefix}[${level}] ${message}`;

    if (level === 'ERROR') {
      console.error(line);
    } else if (level === 'WARN') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}
