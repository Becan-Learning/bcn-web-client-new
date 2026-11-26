/* صفحة التجربة أداة مطوّر: تُغلق (404) في الإنتاج ما لم يُضبط
   `NEXT_PUBLIC_DEMO=1` صراحةً — النمط نفسه لعدّة فحص السبورة. */
export function isDemoAvailable(nodeEnv: string | undefined, flag: string | undefined): boolean {
  return nodeEnv !== "production" || flag === "1";
}

/** First string of a query parameter, or undefined. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first === undefined || first === "" ? undefined : first;
}

/** The LiveKit server URL must be a websocket URL; anything else is treated as missing. */
export function parseServerUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "wss:" || url.protocol === "ws:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
