import React, { useState } from "react";
import { setAuthoredState } from "@concord-consortium/lara-interactive-api";
import {
  buttonLabels, Capitalization, capitalizationLabels, capitalizations, InputView, inputViewHelp, inputViewLabels,
  inputViews, MarkovAuthoredState, maxStartingTextLength, ModeId, modeIds, modeLabels, modesFor, PaneId, paneLabels,
  settingLabels, shownPaneIds, showsStartingMode, showsStartsOpen, startsOpenLabel, UsableModes, usableModesChoices,
  usableModesHelp, usableModesLabels, usableModesOf
} from "./authored-state";

import "./authoring.scss";

// the starting text shows how many characters are left once fewer than this are
const showRemainingBelow = 1000;

// the starting mode's choices, in the order the usable modes list them
const startingModeChoices: readonly ModeId[] = ["draw", "useData"];

interface CheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  // the accessible name, when the visible label alone doesn't say which setting it is
  ariaLabel?: string;
  helpId?: string;
  onChange: (checked: boolean) => void;
}

const Checkbox = ({ id, label, checked, disabled, ariaLabel, helpId, onChange }: CheckboxProps) => (
  <div className="checkbox">
    <label htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} aria-label={ariaLabel}
        aria-describedby={helpId} onChange={e => onChange(e.target.checked)} />
      { label }
    </label>
  </div>
);

interface SelectProps<T extends string> {
  id: string;
  label: string;
  value: T;
  choices: readonly T[];
  labels: Record<T, string>;
  helpId?: string;
  onChange: (value: T) => void;
}

const Select = <T extends string>({ id, label, value, choices, labels, helpId, onChange }: SelectProps<T>) => (
  <div className="form-group">
    <label htmlFor={id}>{ label }</label>
    <select id={id} value={value} aria-describedby={helpId} onChange={e => onChange(e.target.value as T)}>
      { choices.map(choice => <option key={choice} value={choice}>{ labels[choice] }</option>) }
    </select>
  </div>
);

interface Props {
  // the authored state LARA started the form with, already read with readAuthoredState
  initialState: MarkovAuthoredState;
}

// Settings whose dependency is off are left off the page but keep their values, so they return as they were.
export const Authoring = ({ initialState }: Props) => {
  const [state, setState] = useState(initialState);

  // every change is sent to LARA at once; LARA stores it when the author clicks Save
  const update = (change: (current: MarkovAuthoredState) => MarkovAuthoredState) => {
    const next = change(state);
    setState(next);
    setAuthoredState(next);
  };

  const setUsableModes = (usable: UsableModes) => update(current => {
    const modes = modesFor(usable);
    const startingMode = modes[current.startingMode] ? current.startingMode : modeIds.find(m => modes[m]) ?? "useData";
    // students draw on the graph, so Draw makes the Graph pane available
    const panes = modes.draw ? { ...current.panes, graph: { ...current.panes.graph, available: true } } : current.panes;
    return { ...current, modes, startingMode, panes };
  });
  const setPane = (id: PaneId, change: Partial<MarkovAuthoredState["panes"][PaneId]>) =>
    update(current => ({ ...current, panes: { ...current.panes, [id]: { ...current.panes[id], ...change } } }));
  const setProbabilities = (change: Partial<MarkovAuthoredState["buttons"]["probabilities"]>) =>
    update(current => ({
      ...current, buttons: { ...current.buttons, probabilities: { ...current.buttons.probabilities, ...change } }
    }));
  const setButton = (id: "sendToCodap" | "downloadTables", available: boolean) =>
    update(current => ({ ...current, buttons: { ...current.buttons, [id]: { available } } }));
  const setOrderMatters = (change: Partial<MarkovAuthoredState["orderMatters"]>) =>
    update(current => ({ ...current, orderMatters: { ...current.orderMatters, ...change } }));

  const { useData, draw } = state.modes;
  const remaining = Math.max(maxStartingTextLength - state.startingText.length, 0);

  const useDataSettings = (
    <fieldset>
      <legend>{ settingLabels.useData }</legend>
      <Select<InputView> id="inputView" label={settingLabels.inputView} value={state.inputView}
        choices={inputViews} labels={inputViewLabels} helpId="input-view-help"
        onChange={inputView => update(current => ({ ...current, inputView }))} />
      <p id="input-view-help" className="help after-select">{ inputViewHelp[state.inputView] }</p>
      <Select<Capitalization> id="capitalization" label={settingLabels.capitalization} value={state.capitalization}
        choices={capitalizations} labels={capitalizationLabels}
        onChange={capitalization => update(current => ({ ...current, capitalization }))} />
      <fieldset className="form-group">
        <legend className="field-legend">{ settingLabels.ordering }</legend>
        <Checkbox id="orderMattersStartsOn" label={settingLabels.orderMattersStartsOn}
          checked={state.orderMatters.startsOn} helpId="order-matters-help"
          onChange={startsOn => setOrderMatters({ startsOn })} />
        <Checkbox id="orderMattersShowSwitch" label={settingLabels.orderMattersShowSwitch}
          checked={state.orderMatters.showSwitch} helpId="order-matters-help"
          onChange={showSwitch => setOrderMatters({ showSwitch })} />
        <p id="order-matters-help" className="help">
          With &quot;Order matters&quot; on, the next word depends on the word before it (a Markov chain). With it off,
          the next word is picked at random, with words that appear more often more likely to be picked (a weighted bag
          of words).
        </p>
      </fieldset>
      <div className="form-group">
        <label htmlFor="startingText">{ settingLabels.startingText }</label>
        <textarea id="startingText" rows={8} maxLength={maxStartingTextLength} value={state.startingText}
          aria-describedby="starting-text-help"
          onChange={e => {
            const startingText = e.target.value;
            update(current => ({ ...current, startingText }));
          }} />
        <p id="starting-text-help" className="help">
          Leave it empty if students will generate their own data.
          { remaining < showRemainingBelow && ` ${remaining} ${remaining === 1 ? "character" : "characters"} left.` }
        </p>
      </div>
    </fieldset>
  );

  const pane = (id: PaneId) => {
    const { available, startsOpen } = state.panes[id];
    const showStartsOpen = showsStartsOpen(id, state);
    const label = startsOpenLabel(id, state.modes);
    return (
      <div key={id}>
        <Checkbox id={`pane-${id}`} label={paneLabels[id]} checked={available}
          disabled={id === "graph" && draw} helpId={id === "graph" && draw ? "graph-help" : undefined}
          onChange={checked => setPane(id, { available: checked })} />
        { id === "graph" && draw &&
          <p id="graph-help" className="help">
            Draw mode needs the Graph pane. Choose Data alone to make it optional.
          </p> }
        { showStartsOpen &&
          <div className="dependent">
            <Checkbox id={`pane-${id}-startsOpen`} label={label} checked={startsOpen}
              ariaLabel={`${paneLabels[id]} ${label.toLowerCase()}`}
              onChange={checked => setPane(id, { startsOpen: checked })} />
          </div> }
      </div>
    );
  };

  return (
    <form className="authoring" onSubmit={e => e.preventDefault()}>
      <fieldset>
        <legend>{ settingLabels.modes }</legend>
        <Select<UsableModes> id="usableModes" label={settingLabels.usableModes} value={usableModesOf(state.modes)}
          choices={usableModesChoices} labels={usableModesLabels} helpId="modes-help" onChange={setUsableModes} />
        <p id="modes-help" className="help after-select">{ usableModesHelp[usableModesOf(state.modes)] }</p>
        { showsStartingMode(state.modes) &&
          <Select id="startingMode" label={settingLabels.startingMode} value={state.startingMode}
            choices={startingModeChoices} labels={modeLabels}
            onChange={startingMode => update(current => ({ ...current, startingMode }))} /> }
      </fieldset>

      { useData && useDataSettings }

      <fieldset>
        <legend>{ settingLabels.whatStudentsSee }</legend>
        { shownPaneIds(state.modes).map(pane) }
        <Checkbox id="button-probabilities-startsOn" label={settingLabels.probabilitiesStartsOn}
          checked={state.buttons.probabilities.startsOn ?? false} helpId="probabilities-help"
          onChange={startsOn => setProbabilities({ startsOn })} />
        <Checkbox id="button-probabilities" label={buttonLabels.probabilities}
          checked={state.buttons.probabilities.available} helpId="probabilities-help"
          onChange={available => setProbabilities({ available })} />
        <p id="probabilities-help" className="help">
          Without the toggle, probabilities stay shown or hidden as set here.
        </p>
        <fieldset className="form-group">
          <legend className="field-legend">{ settingLabels.sendDataButtons }</legend>
          <Checkbox id="button-sendToCodap" label={buttonLabels.sendToCodap}
            checked={state.buttons.sendToCodap.available} helpId="send-to-codap-help"
            onChange={available => setButton("sendToCodap", available)} />
          <p id="send-to-codap-help" className="help">
            Requires a linked CODAP interactive with the Datalog plugin on the page to work.
          </p>
          <Checkbox id="button-downloadTables" label={buttonLabels.downloadTables}
            checked={state.buttons.downloadTables.available}
            onChange={available => setButton("downloadTables", available)} />
        </fieldset>
      </fieldset>
    </form>
  );
};
