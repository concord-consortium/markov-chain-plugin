import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NodeModal } from "../../components/drawing/node-modal";
import { MarkovHost } from "../../components/host";
import { ArrowWidths, layoutFor } from "../../components/graph-utils";
import { useLatest } from "../../hooks/use-latest";
import { MarkovToolApi } from "../../hooks/use-markov-tool";
import { Node } from "../../type";
import { Capitalization, capitalizationFor, caseSensitiveLabel, orderMattersLabel } from "../authored-state";
import { Token, tokenize, tokensToValues } from "../input/tokenizer";
import { CommitHow, CommitView } from "./commit";
import { ControlsRow } from "./controls-row";
import { GeneratorPane } from "./generator-pane";
import { GraphPane } from "./graph-pane";
import { highlightsFor } from "./highlights";
import { InputPane } from "./input-pane";
import { InspectPane } from "./inspect-pane";
import { RestoredMode } from "./restore-work";
import { SettingLabel, SettingSwitch } from "./setting-switch";
import { useClearGoneSelection, useEscape, useInspectChoices, useScrollToChoice } from "./use-mode-body";
import { ModeSaving, usePaneLayout } from "./use-pane-layout";
import { DataWorkspaceConfig, WorkspacePaneId } from "./workspace-config";
import { WorkspacePanes } from "./workspace-panes";

interface DataWorkspaceProps {
  // the input and its case rule to open with
  text: string;
  capitalization: Capitalization;
  inputSplit: number;
  start: RestoredMode;
  saving: ModeSaving;
  host: MarkovHost;
  tool: MarkovToolApi;
  config: DataWorkspaceConfig;
  stacked: boolean;
  hidden: boolean;
  // the shell's controls, first in the row
  controls: React.ReactNode;
  probabilities: boolean;
  arrowWidths: ArrowWidths;
  orderMatters: boolean;
  onOrderMattersChange: (orderMatters: boolean) => void;
}

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

// Data mode's body: the authored panes around the student's input
export const DataWorkspace = ({
  text: startText, capitalization: startCapitalization, inputSplit: startSplit, start, saving, host, tool, config,
  stacked, hidden, controls, probabilities, arrowWidths, orderMatters, onOrderMattersChange
}: DataWorkspaceProps) => {
  const { inputView } = config;
  const toolRef = useLatest(tool);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const layout = usePaneLayout(config, host, tool, stacked, hidden, start, saving);
  const {
    hasPane, controlsOpen, toggleControls, followRef, handleFit, handleUserZoom, handleGraphResized, top
  } = layout;

  const [text, setText] = useState(startText);
  const [committed, setCommitted] = useState<{ text: string, tokens: Token[] }>(
    () => ({ text: startText, tokens: tokenize(startText, startCapitalization) }));

  const lastValuesRef = useRef(start.tool.values ?? []);
  const lastSavedRef = useRef(startText);

  const [capitalization, setCapitalization] = useState(startCapitalization);
  // reads the text under a rule and hands the core its values when they changed, returning its tokens if they did
  const commitText = useCallback((nextText: string, rule: Capitalization) => {
    const tokens = tokenize(nextText, rule);
    const values = tokensToValues(tokens);
    setText(nextText);
    setCommitted({ text: nextText, tokens });
    if (nextText !== lastSavedRef.current) {
      lastSavedRef.current = nextText;
      saving.requestSave();
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
  }, [tool.handle, saving, followRef]);

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

  useClearGoneSelection(tool);
  const textRef = useLatest(text);

  const handleCaseChange = (caseSensitive: boolean) => {
    const rule = capitalizationFor(caseSensitive);
    setCapitalization(rule);
    commitText(textRef.current, rule);
    host.log("CaseSensitivityChanged", { caseSensitive, states: stateCount(lastValuesRef.current) });
  };
  const isCaseSensitive = capitalization === "asTyped";
  const caseSwitch = config.caseSwitch &&
    <SettingSwitch label={caseSensitiveLabel} value={isCaseSensitive} onChange={handleCaseChange}
      disabled={tool.animating} />;

  const handleOrderChange = (on: boolean) => {
    // a transition can't be chosen in a bag of words; the logged change says why it went
    if (!on && tool.selection?.kind === "transition") {
      tool.setSelectedNodeId();
    }
    onOrderMattersChange(on);
    host.log("OrderMattersToggled", { on });
  };
  const orderSwitch = config.orderMatters.showSwitch &&
    <SettingSwitch label={orderMattersLabel} value={orderMatters} onChange={handleOrderChange}
      disabled={tool.animating} />;
  const switches = (orderSwitch || caseSwitch) &&
    <div className="setting-switches">{ orderSwitch }{ caseSwitch }</div>;

  const [dialogNode, setDialogNode] = useState<Node>();
  const dialogNodeRef = useLatest(dialogNode);
  const orderMattersRef = useLatest(orderMatters);
  const handleDoubleClickState = useCallback((id: string) => {
    // every state's probabilities are the states' counts, which Inspect and the labels already show
    if (!orderMattersRef.current) {
      return;
    }
    const node = toolRef.current.graph.nodes.find(n => n.id === id);
    setDialogNode(node);
    host.log("StateDialogOpened", { state: node?.label ?? id });
  }, [host, toolRef, orderMattersRef]);

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

  useEscape(rootRef, hidden, () => {
    if (dialogNodeRef.current) {
      setDialogNode(undefined);
    } else {
      toolRef.current.clearSelection("escape");
    }
  });

  const [inputSplit, setInputSplit] = useState(startSplit);
  useEffect(() => {
    saving.report.text = committed.text;
    saving.report.capitalization = capitalization;
    saving.report.inputSplit = inputSplit;
  }, [saving, committed.text, capitalization, inputSplit]);
  const handleSplitResized = useCallback((split: number) =>
    host.log("PaneResized", { divider: "inputSplit", sizes: { inputSplit: split } }), [host]);

  const emptyMessage = !hasPane("input")
    ? "No data was provided for this activity."
    : inputView === "table"
      ? "Type some words in the Input pane's table to build the chain."
      : "Type some words in the Input pane to build the chain.";

  // the pane the student last pressed, focused or typed in, where a choice is made, and which doesn't scroll to it
  const sourcePaneRef = useRef<WorkspacePaneId>(undefined);
  useScrollToChoice(rootRef, tool.selection, sourcePaneRef);

  const { handleSelectState, handleSelectTransition } = useInspectChoices(tool);

  const renderPane = (id: WorkspacePaneId) => {
    switch (id) {
      case "input":
        return (
          <InputPane switches={switches} rowLayout={orderMatters ? "prose" : "list"} view={inputView} split={inputSplit}
            onSplitChange={setInputSplit}
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
          <GraphPane tool={tool} log={host.log} top={top} probabilities={probabilities} arrowWidths={arrowWidths}
            orderMatters={orderMatters}
            emptyMessage={emptyMessage} onUserZoom={handleUserZoom} onFit={handleFit}
            onResized={handleGraphResized} initialView={start.view} saving={saving}
            onDoubleClickState={handleDoubleClickState} />
        );
      case "inspect":
        return (
          <InspectPane mode="useData" orderMatters={orderMatters} graph={tool.graph} selection={tool.selection}
            highlights={highlights} log={host.log}
            onSelectState={handleSelectState} onSelectTransition={handleSelectTransition} start={start.inspect}
            report={saving.report} />
        );
      case "generator":
        return <GeneratorPane tool={tool} controlsOpen={controlsOpen} onToggleControls={toggleControls} />;
    }
  };

  return (
    <div className="workspace-body" hidden={hidden} ref={rootRef}>
      <ControlsRow tool={tool}>
        { controls }
        { hasPane("input") ? undefined : switches }
        { !config.orderMatters.showSwitch && <SettingLabel label={orderMattersLabel} value={orderMatters} /> }
        { !config.caseSwitch && <SettingLabel label={caseSensitiveLabel} value={isCaseSensitive} /> }
      </ControlsRow>
      <WorkspacePanes layout={layout} stacked={stacked} sourcePaneRef={sourcePaneRef} renderPane={renderPane} />
      <NodeModal viewMode="dataset" node={dialogNode} graph={tool.graph} onChange={() => undefined}
        onCancel={() => setDialogNode(undefined)} />
    </div>
  );
};
