/**
 * Parse the text payload returned by an MCP tool call into JSON.
 * The MCP server may return a single JSON blob or an array of blobs.
 */
export function parseMcpJson<T = Record<string, unknown>>(
  text: string,
): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    // Sometimes the payload is a JSON array-wrapped string or has leading noise.
    const match = text.match(/\{.*\}|\[.*\]/s);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

/** True if an MCP payload looks empty/errored (error fields, empty arrays). */
export function mcpResultLooksEmpty(payload: unknown): boolean {
  if (!payload) return true;
  if (typeof payload !== 'object') return false;
  const obj = payload as Record<string, unknown>;

  if (obj['error'] !== undefined) {
    const err = obj['error'];
    if (err === '' || err === null) return true;
    if (typeof err === 'string' && err.length > 0) return false;
  }

  if (Array.isArray(obj['items'])) return (obj['items'] as unknown[]).length > 0;
  return false;
}

/** Pull the overall data out of a possibly error-wrapped MCP response. */
export function unwrapMcpPayload<T = unknown>(
  text: string,
  errorKey = 'error',
): T | null {
  const obj = parseMcpJson<T>(text);
  if (!obj) return null;
  if (typeof obj === 'object' && obj !== null) {
    const record = obj as Record<string, unknown>;
    if (record[errorKey] === '' && Object.keys(record).length === 1) {
      return null;
    }
  }
  return obj;
}