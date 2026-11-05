import React, { useMemo } from "react";
import { setInteractiveState, setOnUnload } from "@concord-consortium/lara-interactive-api";
import { MarkovAuthoredState } from "./authored-state";
import { copyState, MarkovInteractiveState, readInteractiveState } from "./interactive-state";
import { settingsSummary } from "./settings-summary";
import { Saver } from "./workspace/use-saved-work";
import { Workspace } from "./workspace/workspace";

interface Props {
  authoredState: MarkovAuthoredState;
  // the student's saved state, as the Activity Player started the interactive with it
  interactiveState?: MarkovInteractiveState | null;
  // where it runs: hosted in the Activity Player, opened outside a host, or showing a student's work in a report,
  // and only the first saves
  view?: "hosted" | "standalone" | "report";
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

// The student's workspace, or in a report a placeholder that lists the authored settings
export const Runtime = ({ authoredState, interactiveState, view = "hosted" }: Props) => {
  const hosted = view === "hosted";
  const savedState = useMemo(() => readInteractiveState(interactiveState), [interactiveState]);

  if (view === "report") {
    return <ReportPlaceholder authoredState={authoredState} />;
  }

  return (
    <>
      { view === "standalone" && (
        <p className="standalone-note">
          Opened outside the Activity Player: the settings come from this page&apos;s link, and nothing is saved.
        </p>
      ) }
      <Workspace authoredState={authoredState} savedState={savedState} saver={hosted ? librarySaver : undefined}
        hosted={hosted} />
    </>
  );
};

// A placeholder for the read-only report view: it lists the authored settings, so authors can check them.
const ReportPlaceholder = ({ authoredState }: { authoredState: MarkovAuthoredState }) => (
  <div className="runtime-placeholder">
    <h2>Markov interactive: coming soon</h2>
    <p className="report-note">A student&apos;s work, shown read-only in a report: nothing here is saved.</p>
    <dl>
      { settingsSummary(authoredState).map(({ label, value }) => (
        <React.Fragment key={label}>
          <dt>{ label }</dt>
          <dd>{ value }</dd>
        </React.Fragment>
      )) }
    </dl>
  </div>
);
