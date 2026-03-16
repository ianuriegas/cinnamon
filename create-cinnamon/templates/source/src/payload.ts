export function parsePayloadArg(raw: string | undefined): Record<string, unknown> {
  if (!raw) {
    return {};
  }

  const parsedNumber = Number(raw);
  if (Number.isInteger(parsedNumber) && parsedNumber > 0) {
    return { start: parsedNumber };
  }

  try {
    const parsedJson = JSON.parse(raw);
    if (parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson)) {
      return parsedJson as Record<string, unknown>;
    }
  } catch {
    // Fall back to plain string payload below.
  }

  return { value: raw };
}
