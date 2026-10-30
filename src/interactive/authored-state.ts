// The settings an author chooses for the Markov Interactive, saved by LARA as the interactive's authored state.
// Settings are read one by one with a default for each (readAuthoredState), so a setting added later reads its
// default from activities saved before it existed, and needs no version change. The version changes only when a
// saved setting's meaning changes, and the reader then converts the older versions.

export const authoredStateVersion = 1;

export const modeIds = ["useData", "draw"] as const;
export type ModeId = typeof modeIds[number];

// The authoring form's one choice of modes, saved as the two modes' availability. No choice leaves students with no
// mode.
export const usableModesChoices = ["draw", "useData", "both"] as const;
export type UsableModes = typeof usableModesChoices[number];

export const usableModesOf = (modes: Record<ModeId, boolean>): UsableModes =>
  modes.useData && modes.draw ? "both" : modes.draw ? "draw" : "useData";

export const modesFor = (usable: UsableModes): Record<ModeId, boolean> =>
  ({ useData: usable !== "draw", draw: usable !== "useData" });

export const paneIds = ["input", "graph", "inspect", "generator"] as const;
export type PaneId = typeof paneIds[number];

export const buttonIds = ["probabilities", "sendToCodap", "downloadTables"] as const;
export type ButtonId = typeof buttonIds[number];

// in the order the form offers them, with the linked choice last
export const inputViews = ["table", "text", "textAndTable"] as const;
export type InputView = typeof inputViews[number];

export const capitalizations = ["lowercase", "asTyped"] as const;
export type Capitalization = typeof capitalizations[number];

export const maxStartingTextLength = 20000;

export interface PaneSettings {
  available: boolean;
  startsOpen: boolean;
}

export interface ButtonSettings {
  available: boolean;
  // only for a toggle button
  startsOn?: boolean;
}

export interface MarkovAuthoredState {
  version: typeof authoredStateVersion;
  modes: Record<ModeId, boolean>;
  startingMode: ModeId;
  panes: Record<PaneId, PaneSettings>;
  buttons: Record<ButtonId, ButtonSettings>;
  inputView: InputView;
  capitalization: Capitalization;
  orderMatters: { startsOn: boolean, showSwitch: boolean };
  startingText: string;
}

export const defaultAuthoredState: MarkovAuthoredState = {
  version: authoredStateVersion,
  modes: { useData: true, draw: true },
  startingMode: "useData",
  panes: {
    input: { available: true, startsOpen: true },
    graph: { available: true, startsOpen: true },
    inspect: { available: true, startsOpen: true },
    generator: { available: true, startsOpen: true },
  },
  buttons: {
    probabilities: { available: true, startsOn: false },
    sendToCodap: { available: false },
    downloadTables: { available: false },
  },
  inputView: "textAndTable",
  capitalization: "lowercase",
  orderMatters: { startsOn: true, showSwitch: true },
  startingText: "",
};

// the labels the authoring form shows, and the runtime's list of settings repeats
export const modeLabels: Record<ModeId, string> = { useData: "Data", draw: "Draw" };
export const usableModesLabels: Record<UsableModes, string> = {
  draw: modeLabels.draw, useData: modeLabels.useData, both: "Both (with a toggle switch for students)"
};
// the help the form shows under a choice, for the option chosen
export const usableModesHelp: Record<UsableModes, string> = {
  draw: "Students draw their own chain.",
  useData: "Students build a chain from text or a table.",
  both: "Students build a chain from text or a table, or draw their own, and switch between the two.",
};
export const paneLabels: Record<PaneId, string> = {
  input: "Input pane", graph: "Graph pane", inspect: "Inspect pane", generator: "Sequence generator pane"
};
export const buttonLabels: Record<ButtonId, string> = {
  probabilities: "Show probabilities toggle", sendToCodap: "Send to CODAP button",
  downloadTables: "Download data files button",
};
export const inputViewLabels: Record<InputView, string> = {
  table: "Table only", text: "Text only", textAndTable: "Linked table and text"
};
export const inputViewHelp: Record<InputView, string> = {
  table: "Students work only in the table and never see the text.",
  text: "Students work only in the text box and never see a table.",
  textAndTable: "Students see their text and a table of its words; changing one changes the other.",
};
export const capitalizationLabels: Record<Capitalization, string> = {
  lowercase: "\"The\" and \"the\" are the same word", asTyped: "\"The\" and \"the\" are different words"
};
export const settingLabels = {
  modes: "Modes",
  usableModes: "Usable mode(s)",
  startingMode: "Starting mode",
  useData: "Data settings",
  inputView: "How students enter their data",
  capitalization: "Capital letters",
  ordering: "Ordering",
  orderMattersStartsOn: "Start with \"Order matters\" on",
  orderMattersShowSwitch: "Show students the \"Order matters\" switch",
  startingText: "Starting data",
  whatStudentsSee: "What students can see",
  startsOpen: "Open at the start",
  // with both modes, since Draw mode always opens its graph and the Graph pane's starting state is Data mode's alone
  graphStartsOpenWithBothModes: "Open at the start in Data mode",
  probabilitiesStartsOn: "Probabilities shown at the start",
  sendDataButtons: "Send data buttons",
};

// a pane's "Open at the start" label; the Graph pane's names the mode it applies to when there are two
export const startsOpenLabel = (id: PaneId, modes: Record<ModeId, boolean>) =>
  id === "graph" && modes.useData && modes.draw ? settingLabels.graphStartsOpenWithBothModes : settingLabels.startsOpen;

// what the authoring form shows and the runtime's list repeats: a setting is left out while what it depends on is off
export const showsStartingMode = (modes: Record<ModeId, boolean>) => modes.useData && modes.draw;

// the Input pane is Data mode's
export const shownPaneIds = (modes: Record<ModeId, boolean>) => paneIds.filter(id => id !== "input" || modes.useData);

// Draw mode always opens its graph, so the Graph pane's starting state only matters with Data mode
export const showsStartsOpen = (id: PaneId, state: Pick<MarkovAuthoredState, "modes" | "panes">) =>
  state.panes[id].available && (id !== "graph" || state.modes.useData);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readBoolean = (value: unknown, fallback: boolean) => typeof value === "boolean" ? value : fallback;

const readChoice = <T extends string>(value: unknown, choices: readonly T[], fallback: T): T =>
  choices.includes(value as T) ? value as T : fallback;

const parse = (raw: unknown): Record<string, unknown> => {
  if (typeof raw === "string") {
    try {
      return parse(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  return isRecord(raw) ? raw : {};
};

const readModes = (raw: unknown) => {
  const saved = isRecord(raw) ? raw : {};
  const modes = {
    useData: readBoolean(saved.useData, defaultAuthoredState.modes.useData),
    draw: readBoolean(saved.draw, defaultAuthoredState.modes.draw),
  };
  // a state with no mode available can't be run, so it reads as the default, both
  return modes.useData || modes.draw ? modes : { ...defaultAuthoredState.modes };
};

const readPanes = (raw: unknown) => {
  const saved = isRecord(raw) ? raw : {};
  const panes = {} as Record<PaneId, PaneSettings>;
  paneIds.forEach(id => {
    const pane = isRecord(saved[id]) ? saved[id] : {};
    const fallback = defaultAuthoredState.panes[id];
    panes[id] = {
      available: readBoolean(pane.available, fallback.available),
      startsOpen: readBoolean(pane.startsOpen, fallback.startsOpen),
    };
  });
  return panes;
};

const readButtons = (raw: unknown) => {
  const saved = isRecord(raw) ? raw : {};
  const buttons = {} as Record<ButtonId, ButtonSettings>;
  buttonIds.forEach(id => {
    const button = isRecord(saved[id]) ? saved[id] : {};
    const fallback = defaultAuthoredState.buttons[id];
    buttons[id] = { available: readBoolean(button.available, fallback.available) };
    if (fallback.startsOn !== undefined) {
      buttons[id].startsOn = readBoolean(button.startsOn, fallback.startsOn);
    }
  });
  return buttons;
};

// Reads whatever LARA or the Activity Player hands the interactive (an object, a JSON string, {} for a new
// interactive, or nothing) as a complete authored state. It never throws, and a complete, valid state reads
// back unchanged.
export const readAuthoredState = (raw: unknown): MarkovAuthoredState => {
  const saved = parse(raw);
  const modes = readModes(saved.modes);
  const startingMode = readChoice(saved.startingMode, modeIds, defaultAuthoredState.startingMode);
  const orderMatters = isRecord(saved.orderMatters) ? saved.orderMatters : {};
  const panes = readPanes(saved.panes);
  // students draw on the graph, so Draw mode always has it
  if (modes.draw) {
    panes.graph.available = true;
  }
  return {
    version: authoredStateVersion,
    modes,
    // students can only start in a mode they have
    startingMode: modes[startingMode] ? startingMode : modes.useData ? "useData" : "draw",
    panes,
    buttons: readButtons(saved.buttons),
    inputView: readChoice(saved.inputView, inputViews, defaultAuthoredState.inputView),
    capitalization: readChoice(saved.capitalization, capitalizations, defaultAuthoredState.capitalization),
    orderMatters: {
      startsOn: readBoolean(orderMatters.startsOn, defaultAuthoredState.orderMatters.startsOn),
      showSwitch: readBoolean(orderMatters.showSwitch, defaultAuthoredState.orderMatters.showSwitch),
    },
    startingText: typeof saved.startingText === "string" ? saved.startingText : defaultAuthoredState.startingText,
  };
};
