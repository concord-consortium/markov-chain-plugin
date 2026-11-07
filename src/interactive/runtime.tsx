import React, { useMemo } from "react";
import { setInteractiveState, setOnUnload } from "@concord-consortium/lara-interactive-api";
import { MarkovAuthoredState } from "./authored-state";
import { copyState, MarkovInteractiveState, readInteractiveState } from "./interactive-state";
import { Saver } from "./workspace/use-saved-work";
import { Workspace } from "./workspace/workspace";

interface Props {
  authoredState: MarkovAuthoredState;
  // the student's saved state, as the host started the interactive with it
  interactiveState?: MarkovInteractiveState | null;
  // where it runs: hosted in the Activity Player, opened outside a host, or showing a student's work in a report,
  // and only the first saves
  view?: "hosted" | "standalone" | "report";
  // where Send to CODAP saves, from the host's runtime message; opaque to everything but the object storage library
  objectStorageConfig?: unknown;
}

// The library deep-freezes what it is handed, and a built state shares objects with the workspace's live state, so it
// gets a copy. Its type wants a state from setOnUnload, but it takes none as "post the state you have".
const librarySaver: Saver = {
  save: state => setInteractiveState<MarkovInteractiveState>(copyState(state)),
  setFinalState: build => setOnUnload(build && (async () => {
    const state = build();
    return state && copyState(state);
  }) as () => Promise<MarkovInteractiveState>),
};

// The student's workspace, which a report shows read-only
export const Runtime = ({ authoredState, interactiveState, view = "hosted", objectStorageConfig }: Props) => {
  const hosted = view === "hosted";
  const savedState = useMemo(() => readInteractiveState(interactiveState), [interactiveState]);

  return (
    <>
      { view === "standalone" && (
        <p className="standalone-note">
          Opened outside the Activity Player: the settings come from this page&apos;s link, and nothing is saved.
        </p>
      ) }
      { view === "report" && (
        <p className="report-note">This is a student&apos;s saved work. It can&apos;t be changed here.</p>
      ) }
      <Workspace authoredState={authoredState} savedState={savedState} saver={hosted ? librarySaver : undefined}
        hosted={hosted} readOnly={view === "report"} objectStorageConfig={objectStorageConfig} />
    </>
  );
};
