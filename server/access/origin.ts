const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
/** Local development treats loopback aliases alike, without weakening deployed CSRF protection. */
export function isAllowedOrigin(
  incoming: string | undefined,
  configured: string,
  mode: string | undefined,
): boolean {
  if (!incoming) return false;
  try {
    const expected = new URL(configured),
      actual = new URL(incoming);
    if (actual.origin !== incoming) return false;
    if (incoming === expected.origin) return true;
    return (
      mode === "development" &&
      loopback.has(expected.hostname) &&
      loopback.has(actual.hostname) &&
      actual.protocol === expected.protocol &&
      actual.port === expected.port
    );
  } catch {
    return false;
  }
}
