export function parsePayloadArg(raw: string | undefined): Record<string, unknown> {
  if (!raw) {
    return {};
  }

  const parsedNumber = Number(raw);
  if (Number.isInteger(parsedNumber) && parsedNumber > 0) {
    return { start: parsedNumber };
  }

  return { value: raw };
}
