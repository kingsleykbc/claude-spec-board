import path from 'node:path';
import { addTokensToLog, logFileRoot, trackTokensOn } from '../hookTokens.js';
import type { AssistantTurn } from './events.js';

const norm = (p: string): string => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

/**
 * Counts a background run's tokens per subtask log from its stream (runs have hooks off, so the plugin hook can't).
 * Like the hook: each message ID counts once, and the tokens since the previous log write go to the log written next.
 */
export class LogTokenTally {
  private readonly seen = new Set<string>();
  private total = 0;
  private mark = 0;
  /** Tokens per log file (absolute path), in the order the logs were first written. */
  readonly perLog = new Map<string, number>();

  constructor(private readonly root: string) {}

  push(turn: AssistantTurn): void {
    if (turn.id === null || !this.seen.has(turn.id)) {
      if (turn.id !== null) this.seen.add(turn.id);
      this.total += turn.tokens;
    }
    for (const w of turn.writes) {
      const abs = path.resolve(this.root, w);
      const root = logFileRoot(abs);
      if (root === null || norm(root) !== norm(this.root)) continue;
      const delta = this.total - this.mark;
      this.mark = this.total;
      if (delta > 0) this.perLog.set(abs, (this.perLog.get(abs) ?? 0) + delta);
    }
  }

  /** Adds each log's count to its `tokens:` when the project tracks tokens. Never throws. */
  async save(): Promise<void> {
    try {
      if (this.perLog.size === 0 || !(await trackTokensOn(this.root))) return;
      for (const [file, delta] of this.perLog) await addTokensToLog(file, delta).catch(() => false);
    } catch {
      // a count that can't be written is left out; the run's total still shows
    }
  }
}
