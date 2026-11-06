import { useMemo } from "react";
import { log } from "@concord-consortium/lara-interactive-api";
import { LogEvent } from "../../components/log-events";
import { MarkovHost } from "../../components/host";
import { ModeId } from "../authored-state";

const noop = () => undefined;
const resolved = () => Promise.resolve();

// the logged actions that save; a commit requests its own, and layout changes ride along with the next save
const savingEvents: ReadonlySet<LogEvent> = new Set<LogEvent>([
  "SequenceGenerated", "SequenceCanceled", "OutputCleared", "GeneratorSettingChanged", "StateMoved", "StateAdded",
  "TransitionAdded", "StateDeleted", "TransitionDeleted", "StateEdited", "GraphReset", "CaseSensitivityChanged",
  "OrderMattersToggled", "ProbabilitiesToggled", "TablesDownloaded",
]);

interface HostSaving {
  requestSave: () => void;
  markActive: () => void;
}

// The Activity Player's side of the Markov tool, one per mode: Data mode is the core's dataset view (values in,
// read-only probabilities) and Draw mode its drawing view. Every event says which mode it came from. Standalone,
// nothing is logged and the library is never called. Everything logged is a student's action, so it counts as the
// student having done something. The functions keep their identity when "Order matters" changes, as MarkovHost
// requires.
export const useApHost = (hosted: boolean, mode: ModeId, { requestSave, markActive }: HostSaving,
  orderMatters?: boolean): MarkovHost => {
  const functions = useMemo(() => ({
    setViewMode: noop,
    markDirty: noop,
    outputSequence: resolved,
    log: hosted
      ? (event: LogEvent, data?: Record<string, unknown>) => {
          log(event, { ...data, mode });
          markActive();
          if (savingEvents.has(event)) {
            requestSave();
          }
        }
      : noop,
  }), [hosted, mode, requestSave, markActive]);
  return useMemo(() => ({
    ...functions, viewMode: mode === "draw" ? "drawing" : "dataset", orderMatters, stopAtNoValue: true,
  }), [functions, mode, orderMatters]);
};
