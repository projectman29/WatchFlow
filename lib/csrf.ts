const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isSameOriginMutation(
  method: string,
  requestOrigin: string,
  originHeader: string | null,
  refererHeader: string | null,
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;

  const source = originHeader ?? refererHeader;
  if (!source) return false;

  try {
    return new URL(source).origin === new URL(requestOrigin).origin;
  } catch {
    return false;
  }
}
