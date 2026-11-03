import React, { useRef } from "react";
import { MarkovTool } from "../components/markov-tool";
import { MarkovHost, MarkovToolHandle } from "../components/host";
import { useCODAP } from "./use-codap";

// The Markov plugin in CODAP: CODAP keeps its saved state, receives its sequences and supplies dataset mode's values.
export const CodapApp = () => {
  const tool = useRef<MarkovToolHandle>(null);
  const { dragging, viewMode, setViewMode, notifyStateIsDirty, loadState, outputSequence } = useCODAP(tool);
  const host: MarkovHost = { viewMode, setViewMode, outputSequence, markDirty: notifyStateIsDirty };
  return <MarkovTool ref={tool} host={host} loadState={loadState} dragging={dragging} />;
};
