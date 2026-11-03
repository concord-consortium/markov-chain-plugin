import { useMemo } from "react";
import { log } from "@concord-consortium/lara-interactive-api";
import { MarkovHost } from "../../components/host";

const noop = () => undefined;
const resolved = () => Promise.resolve();

// The Activity Player's side of the Markov tool. Data mode is the core's dataset view: values in, read-only
// probabilities. Standalone, nothing is logged and the library is never called.
export const useApHost = (hosted: boolean): MarkovHost => useMemo<MarkovHost>(() => ({
  viewMode: "dataset",
  setViewMode: noop,
  markDirty: noop,
  outputSequence: resolved,
  log: hosted ? (event, data) => log(event, data) : noop,
}), [hosted]);
