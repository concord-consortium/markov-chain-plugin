import { defaultAuthoredState, isRecord, MarkovAuthoredState, readAuthoredState } from "./authored-state";

// The settings in a standalone interactive's link: one parameter per setting, named by its path in the authored
// state, such as ?panes.inspect.available=false&startingText=the+cat. The settings and their types come from
// defaultAuthoredState, and readAuthoredState checks the values as it checks a saved state, so a bad, unknown or
// missing value reads as its default.

// a link longer than this may be cut short by the sites and programs it is pasted into
export const longLinkLength = 2000;
// the deployed site refuses a request whose path and query are longer than this, with 414 URI Too Long
export const maxLinkPathLength = 8192;

type Leaf = [string[], unknown];

const leaves = (value: unknown, path: string[] = []): Leaf[] =>
  isRecord(value)
    ? Object.entries(value).reduce<Leaf[]>((all, [key, child]) => all.concat(leaves(child, [...path, key])), [])
    : [[path, value]];

// every setting's path and default; the version is the format's, not a setting
export const urlSettings = leaves(defaultAuthoredState).filter(([path]) => path.join(".") !== "version");

const valueAt = (state: unknown, path: string[]) =>
  path.reduce<unknown>((value, key) => isRecord(value) ? value[key] : undefined, state);

const setAt = (state: Record<string, unknown>, path: string[], value: unknown) => {
  const parent = path.slice(0, -1).reduce<Record<string, unknown>>((record, key) => {
    record[key] = isRecord(record[key]) ? record[key] : {};
    return record[key] as Record<string, unknown>;
  }, state);
  parent[path[path.length - 1]] = value;
};

// a true or false setting is "true" or "false" in a link; any other text is left for the reader to reject
const fromText = (text: string, fallback: unknown) =>
  typeof fallback === "boolean" && (text === "true" || text === "false") ? text === "true" : text;

export const authoredStateFromSearch = (search: string): MarkovAuthoredState => {
  const params = new URLSearchParams(search);
  const state: Record<string, unknown> = {};
  urlSettings.forEach(([path, fallback]) => {
    const text = params.get(path.join("."));
    if (text !== null) {
      setAt(state, path, fromText(text, fallback));
    }
  });
  return readAuthoredState(state);
};

// the settings that differ from the defaults, as a link's query string, or "" when none do
export const searchFromAuthoredState = (state: MarkovAuthoredState) => {
  const params = new URLSearchParams();
  urlSettings.forEach(([path, fallback]) => {
    const value = valueAt(state, path);
    if (value !== fallback) {
      params.set(path.join("."), String(value));
    }
  });
  const search = params.toString();
  return search ? `?${search}` : "";
};
