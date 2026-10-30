import React, { useEffect } from "react";
import { setInteractiveState } from "@concord-consortium/lara-interactive-api";
import { MarkovAuthoredState } from "./authored-state";
import { interactiveStateVersion, MarkovInteractiveState } from "./interactive-state";
import { settingsSummary } from "./settings-summary";

interface Props {
  authoredState: MarkovAuthoredState;
  // the student's saved state, as the Activity Player started the interactive with it
  interactiveState?: MarkovInteractiveState | null;
  // where it runs: hosted in the Activity Player, opened outside a host, or showing a student's work in a report,
  // and only the first saves
  view?: "hosted" | "standalone" | "report";
}

// A placeholder for the student view: it lists the authored settings, so authors can check them.
export const Runtime = ({ authoredState, interactiveState, view = "hosted" }: Props) => {
  // the class dashboard shows a student only once there is interactive state, and counts {} as none
  const hasState = !!interactiveState && Object.keys(interactiveState).length > 0;
  useEffect(() => {
    if (view === "hosted" && !hasState) {
      setInteractiveState<MarkovInteractiveState>({ version: interactiveStateVersion });
    }
  }, [view, hasState]);

  return (
    <div className="runtime-placeholder">
      <h2>Markov interactive: coming soon</h2>
      { view === "standalone" && (
        <p className="standalone-note">
          Opened outside the Activity Player: the settings come from this page&apos;s link, and nothing is saved.
        </p>
      ) }
      { view === "report" && (
        <p className="report-note">A student&apos;s work, shown read-only in a report: nothing here is saved.</p>
      ) }
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
};
