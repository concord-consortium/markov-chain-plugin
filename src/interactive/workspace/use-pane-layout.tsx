import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MarkovHost } from "../../components/host";
import { useLatest } from "../../hooks/use-latest";
import { MarkovToolApi } from "../../hooks/use-markov-tool";
import { Divider } from "./divider";
import {
  collapsedStrip, defaultPaneSizes, dividerLimits, drawnRowHeight, fitPaneSizes, movesDivider, OpenPanes, PaneDivider,
  paneGap, PaneSizes, resizedPanes
} from "./pane-sizes";
import { useMeasuredSize } from "./use-measured-size";
import { WorkspaceConfig, WorkspacePaneId } from "./workspace-config";

const dividerLabels: Record<PaneDivider, string> = {
  input: "Resize Input and Graph", inspect: "Resize Graph and Inspect", rows: "Resize the panes and the generator",
};

// One mode's panes: which are open, their sizes and dividers, and the view following the graph until the student zooms
// or pans. Each mode calls it, so each keeps its own.
export const usePaneLayout = (config: WorkspaceConfig, host: MarkovHost, tool: MarkovToolApi, stacked: boolean,
  hidden: boolean) => {
  const toolRef = useLatest(tool);
  const has = (id: WorkspacePaneId) => config.panes.some(pane => pane.id === id);

  // the view follows the graph, fitting it after each commit, until the student zooms or pans
  const followRef = useRef(true);

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

  // a hidden mode's graph has no size, so it is fitted when its mode shows again, as a reopened Graph pane is, and
  // again once the row is measured, since until then the panes beside it are drawn at their minimums
  const wasHiddenRef = useRef(hidden);
  const fitWhenRowMeasuredRef = useRef(false);
  useEffect(() => {
    if (wasHiddenRef.current && !hidden) {
      fitWhenRowMeasuredRef.current = true;
      handleFit();
    }
    wasHiddenRef.current = hidden;
  }, [hidden, handleFit]);

  const rowPanes = config.panes.filter(pane => pane.id !== "generator");
  const graphOpen = has("graph") && open.graph;
  const rowsDivider = !stacked && has("generator") && open.generator && rowPanes.some(pane => open[pane.id]);

  // the sizes the student chose, kept while a narrow row draws them smaller and while a pane is collapsed
  const [paneSizes, setPaneSizes] = useState<PaneSizes>(defaultPaneSizes);
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
  // an effect, not a layout effect, so it runs after the Graph hears of the size the row was drawn at before this
  useEffect(() => {
    if (rowWidth && fitWhenRowMeasuredRef.current) {
      fitWhenRowMeasuredRef.current = false;
      fitWhenResizedRef.current = true;
    }
  }, [rowWidth]);
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

  return {
    has, open, controlsOpen, togglePane, toggleControls, followRef, handleFit, handleUserZoom, handleGraphResized,
    rowPanes, rowsDivider, rowRef, top, paneStyle, dividerFor, paneDivider,
  };
};
