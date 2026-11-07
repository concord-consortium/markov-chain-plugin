import { useMemo } from "react";
import { log } from "@concord-consortium/lara-interactive-api";
import { LogEvent } from "../../components/log-events";
import { MarkovHost } from "../../components/host";
import { ModeId } from "../authored-state";

const noop = () => undefined;
const resolved = () => Promise.resolve();

// The Activity Player's side of the Markov tool, one per mode: Data mode is the core's dataset view (values in,
// read-only probabilities) and Draw mode its drawing view. Every event says which mode it came from. Standalone,
// nothing is logged and the library is never called. The functions keep their identity when "Order matters" changes,
// as MarkovHost requires.
export const useApHost = (hosted: boolean, mode: ModeId, orderMatters?: boolean): MarkovHost => {
  const functions = useMemo(() => ({
    setViewMode: noop,
    markDirty: noop,
    outputSequence: resolved,
    log: hosted ? (event: LogEvent, data?: Record<string, unknown>) => log(event, { ...data, mode }) : noop,
  }), [hosted, mode]);
  return useMemo(() => ({
    ...functions, viewMode: mode === "draw" ? "drawing" : "dataset", orderMatters, stopAtNoValue: true,
  }), [functions, mode, orderMatters]);
};
