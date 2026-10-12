export async function readJsonResponseBody(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get('content-type') ?? '';
  const rawText = await response.text();

  if (!rawText) {
    return {};
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      return { error: 'Invalid server response.' };
    }
  }

  return { error: rawText };
}
