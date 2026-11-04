import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { useMarkovTool } from "../../hooks/use-markov-tool";
import { useResizeObserver } from "../../hooks/use-resize-observer";
import { NodeModal } from "../../components/drawing/node-modal";
import {
  animatedNodeColor, incomingArrowColor, outgoingArrowColor, selectedNodeColor
} from "../../components/graph-highlight";
import { layoutFor } from "../../components/graph-utils";
import { Node } from "../../type";
import { Capitalization, caseSensitiveLabel, MarkovAuthoredState } from "../authored-state";
import { Token, tokenize, tokensToValues } from "../input/tokenizer";
import { useApHost } from "./ap-host";
import { CommitHow, CommitView } from "./commit";
import { GeneratorPane } from "./generator-pane";
import { GraphPane } from "./graph-pane";
import { highlightsFor } from "./highlights";
import { InputPane } from "./input-pane";
import { InspectPane } from "./inspect-pane";
import { Pane } from "./pane";
import {
  collapsedStrip, controlsRowHeight, defaultInputSplit, defaultPaneSizes, dividerBand, drawnRowHeight, fitPaneSizes,
  dividerLimits, movesDivider, OpenPanes, paneBorder, PaneDivider, paneGap, paneHeader, panePadding, PaneSizes,
  resizedPanes, stackBelow, toolbarButton, toolbarGap, workspaceHeight
} from "./pane-sizes";
import { Divider } from "./divider";
import { scrollTextToMark, scrollToLit } from "./scroll-to-lit";
import { SettingLabel, SettingSwitch } from "./setting-switch";
import { useLatest } from "../../hooks/use-latest";
import { useMeasuredSize } from "./use-measured-size";
import { WorkspaceConfig, workspaceConfig, WorkspacePaneId } from "./workspace-config";

import "./workspace.scss";

interface WorkspaceProps {
  authoredState: MarkovAuthoredState;
  savedInput?: string;
  // saves the input; absent standalone
  onSaveInput?: (text: string) => void;
  hosted: boolean;
}

const paneTitles: Record<WorkspacePaneId, string> = {
  input: "Input", graph: "Graph", inspect: "Inspect", generator: "Sequence Generator"
};

// the sizes and colors the stylesheet reads, so none is written in both languages
const cssValues = {
  "--pane-gap": `${paneGap}px`, "--pane-padding": `${panePadding}px`, "--pane-border": `${paneBorder}px`,
  "--pane-top": `${defaultPaneSizes.top}px`, "--divider-band": `${dividerBand}px`,
  "--collapsed-strip": `${collapsedStrip}px`, "--pane-header": `${paneHeader}px`,
  "--toolbar-button": `${toolbarButton}px`, "--toolbar-gap": `${toolbarGap}px`,
  "--controls-row": `${controlsRowHeight}px`,
  "--highlight-selected": selectedNodeColor, "--highlight-output": animatedNodeColor,
  "--highlight-in": incomingArrowColor, "--highlight-out": outgoingArrowColor,
} as React.CSSProperties;

// panes a commit redraws, so a press there would lose its click; a press elsewhere commits at once
const redrawnByCommit = ".graph-pane .pane-body, .inspect-pane .pane-body";

const stateCount = (values: string[]) => new Set(values.filter(value => value)).size;

const sameValues = (a: string[], b: string[]) => a.length === b.length && a.every((value, i) => value === b[i]);

// whether a commit's states are mostly new, so the graph lays them all out again rather than adding to it
const laidOutWhole = (before: string[], after: string[]) => {
  const placed = new Set(before.filter(value => value));
  const states = new Set(after.filter(value => value));
  return layoutFor([...states].filter(state => placed.has(state)).length, states.size) === "whole";
};

// The student's workspace: the authored panes around the shared Markov tool, in the mode the author starts it in
export const Workspace = (props: WorkspaceProps) => {
  const [config] = useState(() => workspaceConfig(props.authoredState));
  if (config.mode === "draw") {
    return (
      <div className="markov-workspace draw-mode">
        <p className="draw-mode-message">Draw mode arrives in a later version of this interactive.</p>
      </div>
    );
  }
  return <DataWorkspace {...props} config={config} />;
};

const DataWorkspace = ({ authoredState, savedInput, onSaveInput, hosted, config }:
  WorkspaceProps & { config: Extract<WorkspaceConfig, { mode: "useData" }> }) => {
  const { inputView } = config;
  const host = useApHost(hosted);
  const tool = useMarkovTool(host);
  const toolRef = useLatest(tool);
  const has = (id: WorkspacePaneId) => config.panes.some(pane => pane.id === id);
  const hasInputPane = has("input");

  // with no Input pane the student cannot edit the input, so a saved one is ignored
  const [startingText] = useState(() => hasInputPane ? savedInput ?? authoredState.startingText
                                                     : authoredState.startingText);
  const [text, setText] = useState(startingText);
  const [committed, setCommitted] = useState<{ text: string, tokens: Token[] }>(
    () => ({ text: startingText, tokens: tokenize(startingText, config.capitalization) }));
  const [firstValues] = useState(() => tokensToValues(committed.tokens));
  useEffect(() => {
    tool.handle.dataChanged(firstValues);
  }, [tool.handle, firstValues]);

  const lastValuesRef = useRef(firstValues);
  const lastSavedRef = useRef(startingText);
  // the view follows the graph, fitting it after each commit, until the student zooms or pans
  const followRef = useRef(true);

  const [capitalization, setCapitalization] = useState(config.capitalization);
  // reads the text under a rule and hands the core its values when they changed, returning its tokens if they did
  const commitText = useCallback((nextText: string, rule: Capitalization) => {
    const tokens = tokenize(nextText, rule);
    const values = tokensToValues(tokens);
    setText(nextText);
    setCommitted({ text: nextText, tokens });
    if (nextText !== lastSavedRef.current) {
      lastSavedRef.current = nextText;
      onSaveInput?.(nextText);
    }
    if (sameValues(values, lastValuesRef.current)) {
      return undefined;
    }
    if (laidOutWhole(lastValuesRef.current, values)) {
      followRef.current = true;
    }
    lastValuesRef.current = values;
    tool.handle.dataChanged(values, { fit: followRef.current });
    return tokens;
  }, [tool.handle, onSaveInput]);

  const commit = useCallback((nextText: string, how: CommitHow, view: CommitView) => {
    const tokens = commitText(nextText, capitalization);
    if (tokens) {
      host.log("InputCommitted", { view, how, tokens: tokens.length, states: stateCount(lastValuesRef.current) });
    }
  }, [commitText, capitalization, host]);

  const liveTokens = useMemo(() => tokenize(text, capitalization), [text, capitalization]);
  const highlights = useMemo(() => highlightsFor(tool.selection, committed.tokens),
    [tool.selection, committed.tokens]);
  const liveHighlights = useMemo(() => highlightsFor(tool.selection, liveTokens), [tool.selection, liveTokens]);

  // A commit that takes the chosen state or transition out of the graph clears it, logging nothing; an output stays.
  // It runs before the panes' effects, so a choice one makes for the same commit, such as the row Up or Down reaches,
  // isn't cleared with it.
  useLayoutEffect(() => {
    const { selection, graph } = toolRef.current;
    const gone = selection?.kind === "state"
      ? !graph.nodes.some(node => node.id === selection.id)
      : selection?.kind === "transition" &&
        !graph.edges.some(edge => edge.from === selection.from && edge.to === selection.to);
    if (gone) {
      toolRef.current.setSelectedNodeId();
    }
  }, [tool.graph, toolRef]);
  const textRef = useLatest(text);

  const handleCaseChange = (caseSensitive: boolean) => {
    const rule = caseSensitive ? "asTyped" : "lowercase";
    setCapitalization(rule);
    commitText(textRef.current, rule);
    host.log("CaseSensitivityChanged", { caseSensitive, states: stateCount(lastValuesRef.current) });
  };
  const isCaseSensitive = capitalization === "asTyped";
  const caseSwitch = config.caseSwitch &&
    <SettingSwitch label={caseSensitiveLabel} value={isCaseSensitive} onChange={handleCaseChange}
      disabled={tool.animating} />;

  const [open, setOpen] = useState<Record<string, boolean>>(
    () => Object.fromEntries(config.panes.map(pane => [pane.id, pane.startsOpen])));
  const [controlsOpen, setControlsOpen] = useState(true);
  const togglePane = (id: WorkspacePaneId) => {
    const opening = !open[id];
    setOpen(prev => ({ ...prev, [id]: opening }));
    host.log(opening ? "PaneOpened" : "PaneClosed", { pane: id });
    // a hidden graph has no size, so it is fitted when it shows again
    if (id === "graph" && opening) {
      followRef.current = true;
      tool.view.onFitView();
    }
  };
  const toggleControls = () => {
    host.log(controlsOpen ? "PaneClosed" : "PaneOpened", { pane: "generatorControls" });
    setControlsOpen(prev => !prev);
  };

  const handleFit = useCallback(() => {
    followRef.current = true;
    toolRef.current.view.onFitView();
  }, [toolRef]);
  const handleUserZoom = useCallback(() => {
    followRef.current = false;
  }, []);

  const [dialogNode, setDialogNode] = useState<Node>();
  const dialogNodeRef = useLatest(dialogNode);
  const handleDoubleClickState = useCallback((id: string) => {
    const node = toolRef.current.graph.nodes.find(n => n.id === id);
    setDialogNode(node);
    host.log("StateDialogOpened", { state: node?.label ?? id });
  }, [host, toolRef]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  // focus stays in the controls row when the Clear highlight button goes while it has focus, so Tab carries on from
  // there
  const controlsRowRef = useRef<HTMLDivElement>(null);
  const clearButton = useRef<HTMLButtonElement>(null);
  const clearButtonRef = useCallback((button: HTMLButtonElement | null) => {
    const gone = clearButton.current;
    clearButton.current = button;
    if (!button && gone?.ownerDocument.activeElement === gone) {
      controlsRowRef.current?.focus();
    }
  }, []);
  const dimensions = useResizeObserver(rootRef);
  const stacked = !!dimensions && dimensions.width < stackBelow;

  // mouse events (a tap's mousedown follows its pointerup), captured on the window ahead of d3-drag, which stops the
  // mouseup there; a secondary button's menu can swallow its mouseup, so only the primary button presses
  const pressedRef = useRef<Element>(undefined);
  const afterPressRef = useRef<(() => void)[]>([]);
  useEffect(() => {
    const win = rootRef.current?.ownerDocument.defaultView;
    let timer: number | undefined;
    const press = (e: MouseEvent) => {
      pressedRef.current = e.button === 0 && e.target instanceof Element ? e.target : undefined;
    };
    const release = () => {
      pressedRef.current = undefined;
      const waiting = afterPressRef.current;
      afterPressRef.current = [];
      if (waiting.length > 0) {
        timer = window.setTimeout(() => waiting.forEach(run => run()));
      }
    };
    const ends = ["mouseup", "pointercancel", "dragend", "contextmenu"];
    win?.addEventListener("mousedown", press, true);
    ends.forEach(type => win?.addEventListener(type, release, true));
    return () => {
      window.clearTimeout(timer);
      win?.removeEventListener("mousedown", press, true);
      ends.forEach(type => win?.removeEventListener(type, release, true));
    };
  }, []);
  // runs once the current press ends when one is down (on an element matching redrawn, if given), else now
  const afterPress = useCallback((run: () => void, redrawn?: string) => {
    const pressed = pressedRef.current;
    if (pressed && (!redrawn || pressed.closest(redrawn))) {
      afterPressRef.current.push(run);
    } else {
      run();
    }
  }, []);
  const handleBlurCommit = useCallback((commitBlur: () => void) => afterPress(commitBlur, redrawnByCommit),
    [afterPress]);
  const handleTextBlur = useCallback(() => handleBlurCommit(() => commit(textRef.current, "blur", "text")),
    [handleBlurCommit, commit, textRef]);
  const handleTableCommit = useCallback((next: string) => commit(next, "row", "table"), [commit]);
  const handleRowAdded = useCallback(() => host.log("TableRowAdded"), [host]);
  const handleRowDeleted = useCallback(() => host.log("TableRowDeleted"), [host]);

  const handleFocusToken = useCallback((token: Token | undefined) => {
    if (token?.kind === "word") {
      toolRef.current.selectState(token.state, "table", true);
    } else {
      toolRef.current.clearSelection("table");
    }
  }, [toolRef]);

  // a click in the graph focuses nothing, so Escape is heard on the whole document, which is the interactive's own
  useEffect(() => {
    const doc = rootRef.current?.ownerDocument;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") {
        return;
      }
      if (dialogNodeRef.current) {
        setDialogNode(undefined);
      } else {
        toolRef.current.clearSelection("escape");
      }
    };
    doc?.addEventListener("keydown", handleKeyDown);
    return () => doc?.removeEventListener("keydown", handleKeyDown);
  }, [dialogNodeRef, toolRef]);

  const rowPanes = config.panes.filter(pane => pane.id !== "generator");
  const graphOpen = has("graph") && open.graph;
  const rowsDivider = !stacked && has("generator") && open.generator && rowPanes.some(pane => open[pane.id]);

  // the sizes the student chose, kept while a narrow row draws them smaller and while a pane is collapsed
  const [paneSizes, setPaneSizes] = useState<PaneSizes>(defaultPaneSizes);
  const [inputSplit, setInputSplit] = useState(defaultInputSplit);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const rowWidth = useMeasuredSize(rowRef)?.width;
  const openPanes: OpenPanes = {
    input: has("input") && open.input, graph: graphOpen, inspect: has("inspect") && open.inspect
  };
  // the width the open Input, Graph and Inspect panes share
  const room = (rowWidth ?? 0) - paneGap * (rowPanes.length - 1) -
    collapsedStrip * rowPanes.filter(pane => !open[pane.id]).length;
  const sizes = !stacked && rowWidth !== undefined ? fitPaneSizes(paneSizes, room, openPanes) : paneSizes;
  const top = drawnRowHeight(sizes.top, stacked);
  const graphWidth = room - (openPanes.input ? sizes.input : 0) - (openPanes.inspect ? sizes.inspect : 0);

  // the stored sizes this move is measured from
  const moveFromRef = useRef<PaneSizes>(undefined);
  // the stored sizes when the resize began, restored if it went nowhere
  const resizeStartRef = useRef<PaneSizes>(undefined);
  // the sizes the last move stored, which a drag's end can arrive before React renders
  const movedToRef = useRef<PaneSizes>(undefined);
  // whether the last move drew the divider somewhere else than where the resize started, in the row as it was then
  const movedOnScreenRef = useRef(false);
  // a resize changes the graph's size, which it can measure after the resize ends, so it is fitted again then, unless
  // the student has taken the view since
  const fitWhenResizedRef = useRef(false);
  // how many times the graph's size has been laid out, and how many of those it had measured at its last measurement
  const graphLayoutsRef = useRef(0);
  const graphMeasuredRef = useRef(0);
  useLayoutEffect(() => {
    graphLayoutsRef.current += 1;
  }, [graphWidth, top]);
  const handleGraphResized = useCallback(() => {
    const fit = fitWhenResizedRef.current && followRef.current;
    fitWhenResizedRef.current = false;
    graphMeasuredRef.current = graphLayoutsRef.current;
    if (fit) {
      toolRef.current.view.onFitView();
    }
  }, [toolRef]);
  const startResize = () => {
    fitWhenResizedRef.current = false;
    moveFromRef.current = paneSizes;
    resizeStartRef.current ??= paneSizes;
  };
  const moveDivider = (divider: PaneDivider, delta: number) => {
    const next = resizedPanes(moveFromRef.current ?? paneSizes, divider, delta, room, openPanes);
    movedToRef.current = next;
    movedOnScreenRef.current = !!resizeStartRef.current &&
      movesDivider(resizeStartRef.current, next, divider, room, openPanes);
    setPaneSizes(next);
  };
  const endResize = (divider: PaneDivider) => {
    const start = resizeStartRef.current;
    const moved = movedToRef.current;
    resizeStartRef.current = undefined;
    movedToRef.current = undefined;
    if (!start || !moved) {
      return;
    }
    // a move that changed nothing on screen keeps the sizes the student chose
    if (!movedOnScreenRef.current) {
      setPaneSizes(start);
    } else {
      host.log("PaneResized", { divider, sizes: moved });
      if (followRef.current) {
        tool.view.onFitView();
        // the last move not yet rendered, or rendered and not yet measured
        fitWhenResizedRef.current = paneSizes !== moved || graphMeasuredRef.current !== graphLayoutsRef.current;
      }
    }
  };
  const handleSplitResized = useCallback((split: number) =>
    host.log("PaneResized", { divider: "inputSplit", sizes: { inputSplit: split } }), [host]);

  // Input and Inspect keep their widths beside an open graph, and share the row in proportion without one
  const paneStyle = (id: WorkspacePaneId): React.CSSProperties | undefined => {
    if (stacked || !open[id] || (id !== "input" && id !== "inspect")) {
      return undefined;
    }
    const width = sizes[id];
    return graphOpen ? { flex: `0 0 ${width}px` } : { flex: `${width} 0 0`, minWidth: 0 };
  };

  const columnDividers = {
    input: !stacked && openPanes.input && graphOpen,
    inspect: !stacked && graphOpen && openPanes.inspect,
  };
  const dividerLabels: Record<PaneDivider, string> = {
    input: "Resize Input and Graph", inspect: "Resize Graph and Inspect", rows: "Resize the panes and the generator",
  };
  const dividerFor = (divider: PaneDivider) => {
    const limits = { label: dividerLabels[divider], ...dividerLimits(sizes, divider, room, openPanes) };
    return (
      <Divider orientation={divider === "rows" ? "horizontal" : "vertical"} {...limits} onStart={startResize}
        onMove={delta => moveDivider(divider, delta)} onEnd={() => endResize(divider)} />
    );
  };
  const paneDivider = (id: WorkspacePaneId) =>
    id === "input" && columnDividers.input ? dividerFor("input")
      : id === "graph" && columnDividers.inspect ? dividerFor("inspect")
      : undefined;

  const emptyMessage = !hasInputPane
    ? "No data was provided for this activity."
    : inputView === "table"
      ? "Type some words in the Input pane's table to build the chain."
      : "Type some words in the Input pane to build the chain.";

  // the pane the student last pressed, focused or typed in, where a choice is made, and which doesn't scroll to it
  const sourcePaneRef = useRef<WorkspacePaneId>(undefined);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !tool.selection) {
      return;
    }
    const source = sourcePaneRef.current;
    const pane = (id: WorkspacePaneId) => source !== id ? root.querySelector(`.${id}-pane`) : null;
    const input = pane("input");
    if (input) {
      scrollTextToMark(input);
      scrollToLit(input, ".input-table-rows", "tr[class*='highlight-']");
    }
    const inspect = pane("inspect");
    if (inspect) {
      scrollToLit(inspect, ".inspect-panel", "tbody tr[class*='highlight-']");
    }
  }, [tool.selection]);

  const handleSelectState = useCallback((id: string) => toolRef.current.selectState(id, "inspect"), [toolRef]);
  const handleSelectTransition = useCallback((edge: { from: string, to: string }) =>
    toolRef.current.selectTransition(edge, "inspect"), [toolRef]);

  const renderPane = (id: WorkspacePaneId) => {
    switch (id) {
      case "input":
        return (
          <InputPane caseSwitch={caseSwitch} view={inputView} split={inputSplit} onSplitChange={setInputSplit}
            onSplitResized={handleSplitResized} text={text} liveTokens={liveTokens}
            liveHighlights={liveHighlights} committed={committed}
            highlights={highlights}
            readOnly={tool.animating} onChange={setText} onTextCommit={commit} onTextBlur={handleTextBlur}
            onTableCommit={handleTableCommit} onRowBlur={handleBlurCommit} afterPress={afterPress}
            onRowAdded={handleRowAdded}
            onRowDeleted={handleRowDeleted} onFocusToken={handleFocusToken} />
        );
      case "graph":
        return (
          <GraphPane tool={tool} log={host.log} top={top}
            emptyMessage={emptyMessage} onUserZoom={handleUserZoom} onFit={handleFit}
            onResized={handleGraphResized}
            onDoubleClickState={handleDoubleClickState} />
        );
      case "inspect":
        return (
          <InspectPane graph={tool.graph} selection={tool.selection} highlights={highlights} log={host.log}
            onSelectState={handleSelectState} onSelectTransition={handleSelectTransition} />
        );
      case "generator":
        return <GeneratorPane tool={tool} controlsOpen={controlsOpen} onToggleControls={toggleControls} />;
    }
  };

  return (
    <div className={clsx("markov-workspace", { stacked })} style={cssValues} ref={rootRef}>
      <div className="controls-row" tabIndex={-1} ref={controlsRowRef}>
        { hasInputPane ? undefined : caseSwitch }
        { !config.caseSwitch && <SettingLabel label={caseSensitiveLabel} value={isCaseSensitive} /> }
        { tool.selection &&
          <button type="button" className="clear-highlight" disabled={tool.animating} ref={clearButtonRef}
            onClick={() => tool.clearSelection("button")}>
            Clear highlight
          </button>
        }
      </div>
      { rowPanes.length > 0 &&
        <div className="top-row" style={stacked ? undefined : { height: top }} ref={rowRef}>
          { rowPanes.map(({ id }) => (
            <Pane key={id} className={`${id}-pane`} title={paneTitles[id]} open={open[id]}
              onToggle={() => togglePane(id)} onInteract={() => (sourcePaneRef.current = id)} style={paneStyle(id)}
              divider={paneDivider(id)}>
              { renderPane(id) }
            </Pane>
          )) }
          { rowsDivider && dividerFor("rows") }
        </div>
      }
      { has("generator") &&
        <Pane className="generator-pane" title={paneTitles.generator} open={open.generator}
          onToggle={() => togglePane("generator")} onInteract={() => (sourcePaneRef.current = "generator")}
          style={open.generator ? { height: workspaceHeight - top } : undefined}>
          { renderPane("generator") }
        </Pane>
      }
      <NodeModal viewMode="dataset" node={dialogNode} graph={tool.graph} onChange={() => undefined}
        onCancel={() => setDialogNode(undefined)} />
    </div>
  );
};
