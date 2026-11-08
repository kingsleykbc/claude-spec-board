const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Retry an fs operation on Windows EPERM/EBUSY (up to 5 attempts, 50 ms apart). */
export async function withRetry<T>(op: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await op();
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if ((code !== 'EPERM' && code !== 'EBUSY') || attempt >= 5) throw e;
      await sleep(50);
    }
  }
}
