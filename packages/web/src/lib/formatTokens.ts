/** `950`, `48.2k`, `1.3M`: the same as the server's formatTokens (packages/server/src/claude/runs.ts), keeping `.0`. */
export function formatTokens(n: number): string {
  if (n < 1000) return String(Math.round(n));
  const k = Math.round(n / 100) / 10;
  if (k < 1000) return `${k.toFixed(1)}k`;
  return `${(Math.round(n / 100000) / 10).toFixed(1)}M`;
}
