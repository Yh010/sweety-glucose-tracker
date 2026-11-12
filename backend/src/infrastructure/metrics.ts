export class RequestMetrics {
  private count = 0;
  private failures = 0;
  private totalMs = 0;
  private durations: number[] = [];
  observe(status: number, durationMs: number) {
    this.count++;
    if (status >= 500) this.failures++;
    this.totalMs += durationMs;
    this.durations[(this.count - 1) % 256] = durationMs;
  }
  snapshot() {
    const sorted = [...this.durations].sort((a, b) => a - b);
    return {
      requests: this.count,
      serverErrors: this.failures,
      averageMs: this.count ? Math.round(this.totalMs / this.count) : 0,
      recentP95Ms: Math.round(sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0),
      recentSamples: sorted.length,
    };
  }
}
