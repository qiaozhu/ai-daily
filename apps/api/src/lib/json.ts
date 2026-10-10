/** JSON.parse with a fallback (D1 stores arrays as *_json TEXT columns) */
export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(s as string) as T;
  } catch {
    return fallback;
  }
}
