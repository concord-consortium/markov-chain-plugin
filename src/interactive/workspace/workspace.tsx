import React, { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { useMarkovTool } from "../../hooks/use-markov-tool";
import { useResizeObserver } from "../../hooks/use-resize-observer";
import { NodeModal } from "../../components/drawing/node-modal";
import { layoutFor } from "../../components/graph-utils";
import { Node } from "../../type";
import { MarkovAuthoredState } from "../authored-state";
import { Token, tokenize, tokensToValues } from "../input/tokenizer";
import { useApHost } from "./ap-host";
import { GeneratorPane } from "./generator-pane";
import { GraphPane } from "./graph-pane";
import { InputPane } from "./input-pane";
import { Pane } from "./pane";
import {
  collapsedStrip, controlsRowHeight, defaultPaneSizes, paneGap, paneHeader, panePadding, stackBelow, toolbarButton,
  toolbarGap, workspaceHeight
} from "./pane-sizes";
import { useLatest } from "./use-latest";
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

// the sizes the stylesheet reads, so none is written in both languages
const cssSizes = {
  "--pane-gap": `${paneGap}px`, "--pane-padding": `${panePadding}px`, "--pane-top": `${defaultPaneSizes.top}px`,
  "--collapsed-strip": `${collapsedStrip}px`, "--pane-header": `${paneHeader}px`,
  "--toolbar-button": `${toolbarButton}px`, "--toolbar-gap": `${toolbarGap}px`,
  "--controls-row": `${controlsRowHeight}px`,
} as React.CSSProperties;

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
  WorkspaceProps & { config: WorkspaceConfig }) => {
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

  const commit = useCallback((nextText: string) => {
    const tokens = tokenize(nextText, config.capitalization);
    const values = tokensToValues(tokens);
    setCommitted({ text: nextText, tokens });
    if (!sameValues(values, lastValuesRef.current)) {
      if (laidOutWhole(lastValuesRef.current, values)) {
        followRef.current = true;
      }
      lastValuesRef.current = values;
      tool.handle.dataChanged(values, { fit: followRef.current });
    }
    if (nextText !== lastSavedRef.current) {
      lastSavedRef.current = nextText;
      onSaveInput?.(nextText);
    }
  }, [config.capitalization, tool.handle, onSaveInput]);

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
  const dimensions = useResizeObserver(rootRef);
  const stacked = !!dimensions && dimensions.width < stackBelow;

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
  const sizes = defaultPaneSizes;
  const rowsDivider = !stacked && has("generator") && open.generator && rowPanes.some(pane => open[pane.id]);

  // Input and Inspect keep their widths beside an open graph, and share the row in proportion without one
  const paneStyle = (id: WorkspacePaneId): React.CSSProperties | undefined => {
    if (stacked || !open[id] || (id !== "input" && id !== "inspect")) {
      return undefined;
    }
    const width = sizes[id];
    return graphOpen ? { flex: `0 0 ${width}px` } : { flex: `${width} 0 0`, minWidth: 0 };
  };

  const emptyMessage = !hasInputPane
    ? "No data was provided for this activity."
    : config.inputView === "table"
      ? "Type some words in the Input pane's table to build the chain."
      : "Type some words in the Input pane to build the chain.";

  const renderPane = (id: WorkspacePaneId) => {
    switch (id) {
      case "input":
        return (
          <InputPane text={text} readOnly={tool.animating} onChange={setText} onBlur={() => commit(text)} />
        );
      case "graph":
        return (
          <GraphPane tool={tool} log={host.log} top={sizes.top} rowsDivider={rowsDivider} stacked={stacked}
            emptyMessage={emptyMessage} onUserZoom={handleUserZoom} onFit={handleFit}
            onDoubleClickState={handleDoubleClickState} />
        );
      case "inspect":
        return null;
      case "generator":
        return <GeneratorPane tool={tool} controlsOpen={controlsOpen} onToggleControls={toggleControls} />;
    }
  };

  return (
    <div className={clsx("markov-workspace", { stacked })} style={cssSizes} ref={rootRef}>
      <div className="controls-row">
        { tool.selection &&
          <button type="button" className="clear-highlight" onClick={() => tool.clearSelection("button")}>
            Clear highlight
          </button>
        }
      </div>
      { rowPanes.length > 0 &&
        <div className="top-row" style={stacked ? undefined : { height: sizes.top }}>
          { rowPanes.map(({ id }) => (
            <Pane key={id} className={`${id}-pane`} title={paneTitles[id]} open={open[id]}
              onToggle={() => togglePane(id)} style={paneStyle(id)}>
              { renderPane(id) }
            </Pane>
          )) }
        </div>
      }
      { has("generator") &&
        <Pane className="generator-pane" title={paneTitles.generator} open={open.generator}
          onToggle={() => togglePane("generator")}
          style={open.generator ? { height: workspaceHeight - sizes.top } : undefined}>
          { renderPane("generator") }
        </Pane>
      }
      <NodeModal viewMode="dataset" node={dialogNode} graph={tool.graph} onChange={() => undefined}
        onCancel={() => setDialogNode(undefined)} />
    </div>
  );
};
