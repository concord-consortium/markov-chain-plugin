import React, { useCallback, useEffect } from "react";
import { setInteractiveState } from "@concord-consortium/lara-interactive-api";
import { MarkovAuthoredState } from "./authored-state";
import { interactiveStateVersion, MarkovInteractiveState, readSavedInput } from "./interactive-state";
import { settingsSummary } from "./settings-summary";
import { Workspace } from "./workspace/workspace";

interface Props {
  authoredState: MarkovAuthoredState;
  // the student's saved state, as the Activity Player started the interactive with it
  interactiveState?: MarkovInteractiveState | null;
  // where it runs: hosted in the Activity Player, opened outside a host, or showing a student's work in a report,
  // and only the first saves
  view?: "hosted" | "standalone" | "report";
}

// The student's workspace, or in a report a placeholder that lists the authored settings
export const Runtime = ({ authoredState, interactiveState, view = "hosted" }: Props) => {
  const hosted = view === "hosted";
  // the class dashboard shows a student only once there is interactive state, and counts {} as none
  const hasState = !!interactiveState && Object.keys(interactiveState).length > 0;
  useEffect(() => {
    if (hosted && !hasState) {
      setInteractiveState<MarkovInteractiveState>({ version: interactiveStateVersion });
    }
  }, [hosted, hasState]);

  const handleSaveInput = useCallback((text: string) =>
    setInteractiveState<MarkovInteractiveState>({ version: interactiveStateVersion, input: { text } }), []);

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
      <Workspace authoredState={authoredState} savedInput={readSavedInput(interactiveState)} hosted={hosted}
        onSaveInput={hosted ? handleSaveInput : undefined} />
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
