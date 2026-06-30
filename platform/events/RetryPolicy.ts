/**
 * @platform/events/RetryPolicy
 *
 * Pure retry/backoff policy used by the queue. Keeping the policy free of side
 * effects (no timers, no I/O) makes retry behaviour trivially testable and lets
 * the queue, a worker, or a future broker share the exact same rules.
 */

/** Configuration for an exponential-backoff-with-jitter retry policy. */
export interface RetryPolicyConfig {
  /** Maximum delivery attempts before an event is dead-lettered. */
  maxAttempts: number;
  /** Base delay in milliseconds for the first retry. */
  baseDelayMs: number;
  /** Upper bound applied to any computed delay. */
  maxDelayMs: number;
  /** Multiplier applied per attempt (2 = double each time). */
  factor: number;
  /** Fractional jitter [0..1] applied to spread out retries. */
  jitter: number;
}

/** Sensible defaults: 5 attempts, 200ms base, capped at 30s, x2, 20% jitter. */
export const DEFAULT_RETRY_POLICY: RetryPolicyConfig = {
  maxAttempts: 5,
  baseDelayMs: 200,
  maxDelayMs: 30_000,
  factor: 2,
  jitter: 0.2,
};

/**
 * Pure retry policy. Decides whether another attempt is allowed and how long
 * to wait before it. `attempt` is 1-based (1 = the first delivery).
 */
export class RetryPolicy {
  private readonly config: RetryPolicyConfig;

  constructor(config: Partial<RetryPolicyConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_POLICY, ...config };
    if (this.config.maxAttempts < 1) {
      throw new Error('RetryPolicy: maxAttempts must be >= 1');
    }
  }

  /** Total delivery attempts permitted (initial attempt included). */
  get maxAttempts(): number {
    return this.config.maxAttempts;
  }

  /**
   * Whether a further attempt is allowed after `attempt` deliveries have
   * already failed. `attempt` is the number of attempts made so far.
   */
  shouldRetry(attempt: number): boolean {
    return attempt < this.config.maxAttempts;
  }

  /**
   * Backoff delay (ms) before the next attempt, given the number of attempts
   * already made. Deterministic when jitter is 0; otherwise applies +/- jitter.
   */
  nextDelayMs(attempt: number, random: () => number = Math.random): number {
    const exponent = Math.max(0, attempt - 1);
    const raw = this.config.baseDelayMs * Math.pow(this.config.factor, exponent);
    const capped = Math.min(raw, this.config.maxDelayMs);
    if (this.config.jitter <= 0) {
      return Math.round(capped);
    }
    const spread = capped * this.config.jitter;
    const offset = (random() * 2 - 1) * spread;
    return Math.max(0, Math.round(capped + offset));
  }
}
