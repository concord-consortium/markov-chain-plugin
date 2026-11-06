export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// whatever LARA or the Activity Player hands the interactive, an object or a JSON string, as an object; anything
// else, or a string that doesn't parse, is {}
export const parseState = (raw: unknown): Record<string, unknown> => {
  if (typeof raw === "string") {
    try {
      return parseState(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  return isRecord(raw) ? raw : {};
};
