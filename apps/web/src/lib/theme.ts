// Theme state lives on <html data-theme>; /theme.js applies the stored choice before first paint.
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'aidaily.theme';

/** current theme as set by /theme.js before first paint */
export const initialTheme = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

export function applyTheme(t: Theme, persist: boolean) {
  document.documentElement.dataset.theme = t;
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
    } catch {
      /* private mode */
    }
  }
}
