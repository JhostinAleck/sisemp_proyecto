/** Retain the request identity when delivery may have succeeded but its reply was lost. */
export class CommandRetry {
  private pending: { fingerprint: string; key: string } | null = null;
  constructor(
    private readonly uuid: () => string = () => crypto.randomUUID(),
  ) {}
  next(userId: string, command: unknown): string {
    const fingerprint = JSON.stringify([userId, command]);
    if (this.pending?.fingerprint !== fingerprint)
      this.pending = { fingerprint, key: this.uuid() };
    return this.pending.key;
  }
  settle(status?: number): void {
    if (status !== undefined && status < 500) this.reset();
  }
  reset(): void {
    this.pending = null;
  }
}
