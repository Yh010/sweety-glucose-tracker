export const readingChangeKey = 'sweety-reading-change';
export function announceReadingChange() {
  try {
    localStorage.setItem(readingChangeKey, crypto.randomUUID());
  } catch {
    /* Explicit refresh remains available if browser storage is disabled. */
  }
}
