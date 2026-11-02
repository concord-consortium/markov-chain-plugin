import {
  buttonLabels, capitalizationLabels, inputViewLabels, MarkovAuthoredState, modeLabels, PaneId, paneLabels,
  settingLabels, shownPaneIds, showsStartingMode, showsStartsOpen, startsOpenLabel, usableModesLabels, usableModesOf
} from "./authored-state";

export interface SettingSummary {
  label: string;
  value: string;
}

// how much of the starting text the summary repeats before giving its full length
const startingTextPreviewLength = 100;

const yesNo = (value: boolean) => value ? "Yes" : "No";
const availability = (value: boolean) => value ? "Available" : "Not available";

const startingTextValue = (text: string) => {
  if (text === "") {
    return "(empty)";
  }
  // a cut between a character's two halves would leave half of it, so that half goes too
  const cut = text.slice(0, startingTextPreviewLength).replace(/[\uD800-\uDBFF]$/, "");
  const preview = text.length > startingTextPreviewLength ? `${cut}...` : text;
  return `${preview} (${text.length} ${text.length === 1 ? "character" : "characters"})`;
};

// The authored settings as the runtime's placeholder lists them, in the authoring form's order and with its labels.
// As in the form, a setting is left out while what it depends on is off.
export const settingsSummary = (state: MarkovAuthoredState): SettingSummary[] => {
  const { useData } = state.modes;
  const pane = (id: PaneId): SettingSummary[] => {
    const { available, startsOpen } = state.panes[id];
    const showStartsOpen = showsStartsOpen(id, state);
    return [
      { label: paneLabels[id], value: availability(available) },
      ...(showStartsOpen
        ? [{ label: `${paneLabels[id]}: ${startsOpenLabel(id, state.modes)}`, value: yesNo(startsOpen) }]
        : []),
    ];
  };
  return [
    { label: settingLabels.usableModes, value: usableModesLabels[usableModesOf(state.modes)] },
    ...(showsStartingMode(state.modes)
      ? [{ label: settingLabels.startingMode, value: modeLabels[state.startingMode] }]
      : []),
    ...(useData ? [
      { label: settingLabels.inputView, value: inputViewLabels[state.inputView] },
      { label: settingLabels.capitalization, value: capitalizationLabels[state.capitalization] },
      { label: settingLabels.orderMattersStartsOn, value: yesNo(state.orderMatters.startsOn) },
      { label: settingLabels.orderMattersShowSwitch, value: yesNo(state.orderMatters.showSwitch) },
      { label: settingLabels.startingText, value: startingTextValue(state.startingText) },
    ] : []),
    ...shownPaneIds(state.modes).reduce<SettingSummary[]>((all, id) => all.concat(pane(id)), []),
    { label: settingLabels.probabilitiesStartsOn, value: yesNo(state.buttons.probabilities.startsOn ?? false) },
    { label: buttonLabels.probabilities, value: availability(state.buttons.probabilities.available) },
    { label: buttonLabels.sendToCodap, value: availability(state.buttons.sendToCodap.available) },
    { label: buttonLabels.downloadTables, value: availability(state.buttons.downloadTables.available) },
  ];
};
