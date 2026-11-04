import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useGraph } from "./use-graph";
import { DelimiterType, Edge, GenerationMode, GraphData, Node, SequenceGroup } from "../type";
import { GeneratorProps } from "../components/generator";
import { SequenceOutputProps } from "../components/sequence-output";
import { IConfirmModal } from "../components/confirm-modal";
import { clampLengthLimit, graphToRestore } from "../components/app-utils";
import { generateSequence } from "../utils/generate-sequence";
import { moveOriginToCenter } from "../utils/plugin-state";
import { ClearVia, MarkovHost, MarkovToolHandle, Selection, SelectionSource } from "../components/host";

const fastAnimationOverride = parseInt((new URLSearchParams(window.location.search)).get("fastSpeed") ?? "", 10);
const normalAnimationOverride = parseInt((new URLSearchParams(window.location.search)).get("normalSpeed") ?? "", 10);

const FastAnimationDelay = isNaN(fastAnimationOverride) ? 250 : fastAnimationOverride;
const NormalAnimationDelay = isNaN(normalAnimationOverride) ? 1000 : normalAnimationOverride;

const defaultLengthLimit = 5;
const defaultDelimiter = " ";
const defaultStartingState = "";
const defaultFastSimulation = false;

// a click on the chosen state, or on nothing, unchooses it, unless skipToggle keeps it chosen
const nextSelectedNodeId = (id: string | undefined, selectedNodeId: string | undefined, skipToggle?: boolean) =>
  (!id || id === selectedNodeId) && !skipToggle ? undefined : id;

// The Markov tool's state and handlers, apart from any layout: MarkovTool lays them out for the CODAP plugin and the
// workspace for the Activity Player.
export interface MarkovToolApi {
  handle: MarkovToolHandle;
  graph: GraphData;
  graphEmpty: boolean;
  animating: boolean;
  // what the graph draws: the animation's highlights and the chosen state, transition or output
  graphHighlights: {
    highlightNode?: Node, highlightLoopOnNode?: Node, highlightEdge?: Edge, highlightAllNextNodes: boolean,
    highlightOutputNodes?: Node[], selectedNodeId?: string, selectedEdge?: { from: string, to: string },
  };
  setSelectedNodeId: (id?: string, skipToggle?: boolean) => void;
  selection: Selection;
  // setSelectedNodeId with where the choice was made: it toggles as a click on a state does
  selectState: (id: string | undefined, source: SelectionSource, skipToggle?: boolean) => void;
  // chooses a transition, or clears it when it is already chosen
  selectTransition: (edge: { from: string, to: string }, source: SelectionSource) => void;
  clearSelection: (via: ClearVia) => void;
  generatorProps: GeneratorProps;
  outputProps: SequenceOutputProps;
  view: {
    fitViewAt?: number, recenterViewAt?: number, resetViewAt?: number, graphOpacity: number,
    onFitView: () => void, onRecenterView: () => void, onReset: () => void,
    onDimensions: (dimensions: { width: number, height: number }) => void,
    setGraph: React.Dispatch<React.SetStateAction<GraphData>>,
    setHighlightNode: React.Dispatch<React.SetStateAction<Node | undefined>>,
    onClearHighlightOutput: () => void, confirmModal?: IConfirmModal,
    onSelectDatasetMode: () => void, onSelectDrawingMode: () => void, onReturnToMainMenu: () => void,
  };
}

export const useMarkovTool = (host: MarkovHost): MarkovToolApi => {
  const { viewMode, setViewMode, markDirty, outputSequence, log } = host;
  const [lengthLimit, setLengthLimit] = useState<number | undefined>(defaultLengthLimit);
  const [delimiter, setDelimiter] = useState(defaultDelimiter);
  const [startingState, setStartingState] = useState(defaultStartingState);
  const [sequenceGroups, setSequenceGroups] = useState<SequenceGroup[]>([]);
  const [selectedNodeId, _setSelectedNodeId] = useState<string>();
  const [selectedEdge, setSelectedEdge] = useState<{ from: string, to: string }>();
  const [highlightNode, setHighlightNode] = useState<Node>();
  const [highlightLoopOnNode, setHighlightLoopOnNode] = useState<Node>();
  const [highlightEdge, setHighlightEdge] = useState<Edge>();
  const [highlightAllNextNodes, setHighlightAllNextNodes] = useState(false);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("ready");
  const prevAnimatedSequenceGroups = useRef<SequenceGroup[]>([]);
  const currentAnimatedSequenceGroup = useRef<SequenceGroup | undefined>(undefined);
  const currentAnimationStep = useRef<"before" | "after">("before");
  const prevSequences = useRef<Node[][]>([]);
  const currentSequence = useRef<Node[]>([]);
  const currentSequenceIndex = useRef(0);
  const animationInterval = useRef<number | undefined>(undefined);
  const unmountedRef = useRef(false);
  // the last values logged for the settings that log when their field loses focus
  const loggedLengthLimitRef = useRef<number | undefined>(defaultLengthLimit);
  const loggedDelimiterRef = useRef(defaultDelimiter);
  // the starting state's label when the playing or stepping sequence started
  const startingLabelRef = useRef("");
  const { graph, updateGraph, setGraph } = useGraph();
  const [initialGraph, setInitialGraph] = useState<GraphData>();
  const [fitViewAt, setFitViewAt] = useState<number>();
  // fit in the render after the graph change, once Graph has drawn the new graph
  // every graph change must produce a new graph object, or this effect never runs
  const fitAfterGraphChangeRef = useRef(false);
  useEffect(() => {
    if (fitAfterGraphChangeRef.current) {
      fitAfterGraphChangeRef.current = false;
      setFitViewAt(Date.now());
    }
  }, [graph]);
  const [recenterViewAt, setRecenterViewAt] = useState<number>();
  const [resetViewAt, setResetViewAt] = useState<number>();
  const datasetValuesRef = useRef<string[] | undefined>(undefined);
  const onDataChanged = useCallback((values: string[], options?: { fit?: boolean }) => {
    datasetValuesRef.current = values;
    updateGraph(values);
    fitAfterGraphChangeRef.current = options?.fit ?? true;
  }, [updateGraph]);
  const widthRef = useRef(0);
  const heightRef = useRef(0);
  const onSetGraph = useCallback((data: GraphData, version: number) => {

    const done = () => {
      setGraph(data);
      fitAfterGraphChangeRef.current = true;
    };

    const translateOrigin = () => {
      if (unmountedRef.current) {
        return;
      }
      if (!widthRef.current || !heightRef.current) {
        setTimeout(translateOrigin, 1);
      } else {
        moveOriginToCenter(data.nodes, widthRef.current, heightRef.current);
        done();
      }
    };

    if (version < 2) {
      translateOrigin();
    } else {
      done();
    }
  }, [setGraph]);
  const [fastSimulation, setFastSimulation] = useState(defaultFastSimulation);
  const fastSimulationRef = useRef(false);
  const [highlightOutput, setHighlightOutput] = useState<{group: SequenceGroup, sequence: Node[]}|undefined>();
  const [delimiterType, setDelimiterType] = useState<DelimiterType>(
    delimiter === "" ? "none" : (delimiter === " " ? "space" : "other"));
  const [confirmModal, setConfirmModal] = useState<IConfirmModal|undefined>(undefined);
  const [graphOpacity, setGraphOpacity] = useState(1);

  const handleDimensionChange = ({ width, height }: {width: number, height: number}) => {
    widthRef.current = width;
    heightRef.current = height;
  };

  const animating = useMemo(() => {
    return generationMode !== "ready";
  }, [generationMode]);

  const setSelectedNodeId = useCallback((id?: string, skipToggle?: boolean) => {
    if (!animating) {
      setHighlightOutput(undefined);
      setSelectedEdge(undefined);
      _setSelectedNodeId(nextSelectedNodeId(id, selectedNodeId, skipToggle));
    }
  }, [_setSelectedNodeId, selectedNodeId, animating]);

  useEffect(() => {
    if (viewMode === "drawing") {
      markDirty();
    }
  }, [graph, viewMode, markDirty]);

  const graphEmpty = useMemo(() => graph.nodes.length === 0, [graph]);

  // the log names states by their labels; "" is no state, as for any starting state
  const labelOf = useCallback((id: string) => id && (graph.nodes.find(n => n.id === id)?.label ?? id), [graph]);
  // the starting state's label, "" for none or one no longer in the graph, which generates as none
  const startingLabel = useCallback(() => graph.nodes.find(n => n.id === startingState)?.label ?? "",
    [graph, startingState]);

  const highlightOutputNodes = useMemo(() => {
    return animating ? undefined : highlightOutput?.sequence;
  }, [animating, highlightOutput]);

  const generateNewSequence = useCallback(async () => {
    currentSequence.current = [];
    currentSequenceIndex.current = 0;

    const limit = clampLengthLimit(lengthLimit);
    if (limit !== undefined) {
      const startingNode = startingState.length > 0 ? graph.nodes.find(n => n.id === startingState) : undefined;
      startingLabelRef.current = startingNode?.label ?? "";

      prevAnimatedSequenceGroups.current = [...sequenceGroups];
      currentAnimatedSequenceGroup.current =
        prevAnimatedSequenceGroups.current[prevAnimatedSequenceGroups.current.length - 1];
      if ((currentAnimatedSequenceGroup.current?.delimiter !== delimiter) ||
        (currentAnimatedSequenceGroup.current.lengthLimit !== limit) ||
        (currentAnimatedSequenceGroup.current.startingState !== startingState)) {
        currentAnimatedSequenceGroup.current =
          { delimiter, lengthLimit: limit, startingState, startingNode, sequences: [] };
        setSequenceGroups(prevAnimatedSequenceGroups.current);
      } else {
        prevAnimatedSequenceGroups.current.pop();
      }

      prevSequences.current = [...currentAnimatedSequenceGroup.current.sequences];
      // currentAnimatedSequenceGroup.current.sequences.push("");

      currentSequence.current = await generateSequence(graph, { startingNode, lengthLimit: limit });
      currentAnimationStep.current = "before";
    }
  }, [graph, lengthLimit, startingState, sequenceGroups, delimiter]);

  const currentSequenceAnimating = () => currentSequenceIndex.current < currentSequence.current.length - 1;

  const inBeforeStep = () => currentAnimationStep.current === "before";

  const animateCurrentSequenceIndex = useCallback(() => {
    const currentNode = currentSequence.current[currentSequenceIndex.current];
    const nextNode = currentSequence.current[currentSequenceIndex.current + 1];

    if (inBeforeStep()) {
      setHighlightNode(currentNode);
      setHighlightEdge(undefined);
      // highlight all the possible edges if we have a next node
      setHighlightAllNextNodes(!!nextNode);
      setHighlightLoopOnNode(currentNode);
    } else {
      const edge = nextNode
      ? graph.edges.find(e => e.from === currentNode.id && e.to === nextNode.id)
      : undefined;
      setHighlightEdge(edge);
      setHighlightNode(nextNode);
      setHighlightAllNextNodes(false);
      setHighlightLoopOnNode(nextNode === currentNode ? nextNode : undefined);
    }

    if (currentAnimatedSequenceGroup.current) {
      const delta = inBeforeStep() ? 1 : 2;
      const animatedSequence = currentSequence.current.slice(0, currentSequenceIndex.current + delta);
      currentAnimatedSequenceGroup.current.sequences = [...prevSequences.current, animatedSequence];
      setSequenceGroups([...prevAnimatedSequenceGroups.current, currentAnimatedSequenceGroup.current]);
    }

  }, [setSequenceGroups, graph]);

  // the settings the playing or stepping sequence was started with, and the speed now
  const sequenceSettings = useCallback(() => {
    const group = currentAnimatedSequenceGroup.current;
    return {
      startingState: startingLabelRef.current, maxLength: group?.lengthLimit, delimiter: group?.delimiter,
      fast: fastSimulationRef.current,
    };
  }, []);

  const finishAnimating = useCallback(async (cancel?: boolean) => {
    setHighlightNode(undefined);
    setHighlightEdge(undefined);
    setHighlightLoopOnNode(undefined);
    stopAnimationInterval();

    if (!cancel) {
      const labels = currentSequence.current.map(state => state.label);
      log("SequenceGenerated", { sequence: labels, ...sequenceSettings() });
      await outputSequence(labels);

      if (currentAnimatedSequenceGroup.current) {
        currentAnimatedSequenceGroup.current.sequences = [...prevSequences.current, currentSequence.current];
        setSequenceGroups([...prevAnimatedSequenceGroups.current, currentAnimatedSequenceGroup.current]);
      }
    }

    setGenerationMode("ready");
  }, [outputSequence, log, sequenceSettings]);

  const animateNextSequenceIndex = useCallback(() => {
    if (inBeforeStep()) {
      currentAnimationStep.current = "after";
    } else {
      currentAnimationStep.current = "before";
      currentSequenceIndex.current++;
    }
    if (currentSequenceAnimating()) {
      animateCurrentSequenceIndex();
    } else {
      finishAnimating();
    }
  }, [animateCurrentSequenceIndex, finishAnimating]);

  const startAnimationInterval = useCallback(() => {
    // this allows the animation speed to change during the animation
    const getNext = () => Date.now() + (fastSimulationRef.current ? FastAnimationDelay : NormalAnimationDelay) - 1;
    let next = getNext();

    animationInterval.current = window.setInterval(() => {
      if (Date.now() < next) {
        return;
      }
      next = getNext();

      if (currentSequenceAnimating()) {
        animateNextSequenceIndex();
      } else {
        finishAnimating();
      }
    }, FastAnimationDelay);
  }, [animateNextSequenceIndex, finishAnimating]);

  const stopAnimationInterval = () => {
    window.clearInterval(animationInterval.current);
  };

  const handleChangeLengthLimit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numberValue = parseInt(e.target.value, 10);
    setLengthLimit(isNaN(numberValue) ? undefined : numberValue);
  };

  // Enter and then a blur commit the same value, which is logged once
  const handleCommitLengthLimit = () => {
    const clamped = clampLengthLimit(lengthLimit);
    setLengthLimit(prev => clampLengthLimit(prev));
    if (clamped !== undefined && clamped !== loggedLengthLimitRef.current) {
      loggedLengthLimitRef.current = clamped;
      log("GeneratorSettingChanged", { setting: "maxLength", value: clamped });
    }
  };

  const handleCommitDelimiter = () => {
    if (delimiter !== loggedDelimiterRef.current) {
      loggedDelimiterRef.current = delimiter;
      log("GeneratorSettingChanged", { setting: "delimiter", value: delimiter });
    }
  };

  const handleChangeDelimiter = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDelimiter(e.target.value);
  };

  const handleChangeDelimiterType = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as DelimiterType;
    setDelimiterType(newType);
    const newDelimiter = newType === "space" ? " " : "";
    setDelimiter(newDelimiter);
    loggedDelimiterRef.current = newDelimiter;
    log("GeneratorSettingChanged", { setting: "delimiterType", value: newType });
  };

  const handleChangeStartingState = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStartingState(e.target.value);
    log("GeneratorSettingChanged", { setting: "startingState", value: labelOf(e.target.value) });
  };

  const handleClearOutput = useCallback(() => {
    setSequenceGroups([]);
    log("OutputCleared");
  }, [log]);

  const handlePause = useCallback(() => {
    setGenerationMode("paused");
    stopAnimationInterval();
    log("SequencePaused", sequenceSettings());
  }, [log, sequenceSettings]);

  const handleResume = useCallback(async () => {
    log("SequenceResumed", sequenceSettings());
    if (currentSequenceAnimating()) {
      setGenerationMode("playing");
      startAnimationInterval();
    } else {
      await finishAnimating();
    }
  }, [finishAnimating, startAnimationInterval, log, sequenceSettings]);

  const handleStep = useCallback(async () => {
    setHighlightOutput(undefined);
    if ((generationMode !== "stepping") && (generationMode !== "paused")) {
      setGenerationMode("stepping");
      await generateNewSequence();
      if (unmountedRef.current) {
        return;
      }
      log("SequenceStepped", sequenceSettings());
      animateCurrentSequenceIndex();
    } else if (currentSequenceAnimating()) {
      log("SequenceStepped", sequenceSettings());
      animateNextSequenceIndex();
    } else {
      log("SequenceStepped", sequenceSettings());
      await finishAnimating();
    }
  }, [generationMode, animateCurrentSequenceIndex, animateNextSequenceIndex, finishAnimating, generateNewSequence,
      log, sequenceSettings]);

  const handlePlay = useCallback(async () => {
    log("SequencePlayed", {
      startingState: startingLabel(), maxLength: clampLengthLimit(lengthLimit), delimiter, fast: fastSimulation
    });
    setHighlightOutput(undefined);
    setGenerationMode("playing");
    await generateNewSequence();
    if (unmountedRef.current) {
      return;
    }
    animateCurrentSequenceIndex();
    startAnimationInterval();
  }, [generateNewSequence, animateCurrentSequenceIndex, startAnimationInterval, log, startingLabel, lengthLimit,
      delimiter, fastSimulation]);

  const handleSpeedToggle = useCallback((value: boolean) => {
    setFastSimulation(value);
    fastSimulationRef.current = value;
    log("GeneratorSettingChanged", { setting: "fast", value });
  }, [setFastSimulation, log]);

  const handleCancel = useCallback(() => {
    log("SequenceCanceled", sequenceSettings());
    finishAnimating(true);
  }, [finishAnimating, log, sequenceSettings]);

  const toggleHighlightOutput = useCallback((group: SequenceGroup, sequence: Node[]) => {
    if (animating) {
      return;
    }
    setSelectedNodeId();
    if ((highlightOutput?.group !== group) || (highlightOutput.sequence !== sequence)) {
      setHighlightOutput({ group, sequence });
      log("OutputSelected", { sequence: sequence.map(state => state.label) });
    } else {
      setHighlightOutput(undefined);
      log("SelectionCleared", { via: "toggle" });
    }
  }, [animating, highlightOutput, setHighlightOutput, setSelectedNodeId, log]);

  const handleClearHighlightOutput = () => setHighlightOutput(undefined);

  const selection = useMemo<Selection>(() => {
    if (selectedNodeId) {
      return { kind: "state", id: selectedNodeId };
    }
    if (selectedEdge) {
      return { kind: "transition", ...selectedEdge };
    }
    if (highlightOutput) {
      return { kind: "output", ...highlightOutput };
    }
  }, [selectedNodeId, selectedEdge, highlightOutput]);

  // only a change to the selection is logged, not a choice that leaves it as it was
  const selectState = useCallback((id: string | undefined, source: SelectionSource, skipToggle?: boolean) => {
    if (animating) {
      return;
    }
    const next = nextSelectedNodeId(id, selectedNodeId, skipToggle);
    if (!next && selection) {
      log("SelectionCleared", { via: "toggle" });
    } else if (next && next !== selectedNodeId) {
      log("StateSelected", { state: labelOf(next), source });
    }
    setSelectedNodeId(id, skipToggle);
  }, [animating, selectedNodeId, selection, setSelectedNodeId, log, labelOf]);

  const selectTransition = useCallback((edge: { from: string, to: string }, source: SelectionSource) => {
    if (animating) {
      return;
    }
    const chosen = edge.from === selectedEdge?.from && edge.to === selectedEdge?.to;
    _setSelectedNodeId(undefined);
    setHighlightOutput(undefined);
    setSelectedEdge(chosen ? undefined : edge);
    if (chosen) {
      log("SelectionCleared", { via: "toggle" });
    } else {
      log("TransitionSelected", { from: labelOf(edge.from), to: labelOf(edge.to), source });
    }
  }, [animating, selectedEdge, log, labelOf]);

  const clearSelection = useCallback((via: ClearVia) => {
    if (animating) {
      return;
    }
    if (selection) {
      log("SelectionCleared", { via });
    }
    _setSelectedNodeId(undefined);
    setSelectedEdge(undefined);
    setHighlightOutput(undefined);
  }, [animating, selection, log]);

  const handleSelectDatasetMode = () => {
    setViewMode("dataset");
    markDirty();
  };

  const handleSelectDrawingMode = () => {
    setViewMode("drawing");
    markDirty();
  };

  const handleReset = useCallback(() => {
    setConfirmModal({
      title: "Reset?",
      message: <>Are you sure you want to reset?<br/>Any changes you have made will be lost.</>,
      onOk: () => {
        log("GraphReset");
        setLengthLimit(defaultLengthLimit);
        loggedLengthLimitRef.current = defaultLengthLimit;
        setDelimiter(defaultDelimiter);
        loggedDelimiterRef.current = defaultDelimiter;
        setStartingState(defaultStartingState);
        setSequenceGroups([]);
        setFastSimulation(defaultFastSimulation);
        fastSimulationRef.current = defaultFastSimulation;
        setGraphOpacity(0);
        setSelectedNodeId();
        setGraph({ nodes: [], edges: [] });
        setResetViewAt(Date.now());
        setTimeout(() => {
          if (unmountedRef.current) {
            return;
          }
          const restoredGraph = graphToRestore(viewMode, initialGraph, datasetValuesRef.current);
          if (restoredGraph) {
            setGraph(restoredGraph);
            fitAfterGraphChangeRef.current = true;
          } else {
            setFitViewAt(Date.now());
          }
          setGraphOpacity(1);
        }, 1);
      },
      onClose: () => setConfirmModal(undefined)
    });
  }, [viewMode, initialGraph, setGraph, setSelectedNodeId, log]);

  const handleReturnToMainMenu = () => {
    setConfirmModal({
      title: "Back To Main Menu?",
      message: <>Are you sure you want to go back to the main menu?<br/>Any changes you have made will be lost.</>,
      onOk: () => {
        setGraph({ nodes: [], edges: [] });
        setInitialGraph(undefined);
        datasetValuesRef.current = undefined;
        setViewMode(undefined);
      },
      onClose: () => setConfirmModal(undefined)
    });
  };

  const handleFitView = () => {
    setFitViewAt(Date.now());
  };

  const handleRecenterView = () => {
    setRecenterViewAt(Date.now());
  };

  // stop what would otherwise outlive the tool: the animation and the wait for the graph's size
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      stopAnimationInterval();
    };
  }, []);

  // one handle for the tool's lifetime; getGraph reads the graph the last render committed
  const graphRef = useRef(graph);
  useLayoutEffect(() => {
    graphRef.current = graph;
  }, [graph]);
  const handle = useMemo<MarkovToolHandle>(() => ({
    getGraph: () => graphRef.current,
    loadDrawing: (data, version) => {
      onSetGraph(data, version);
      setInitialGraph({ nodes: data.nodes.map(n => ({ ...n })), edges: data.edges.map(e => ({ ...e })) });
    },
    dataChanged: onDataChanged,
  }), [onSetGraph, onDataChanged]);

  return {
    handle, graph, graphEmpty, animating,
    graphHighlights: {
      highlightNode, highlightLoopOnNode, highlightEdge, highlightAllNextNodes, highlightOutputNodes, selectedNodeId,
      selectedEdge,
    },
    setSelectedNodeId, selection, selectState, selectTransition, clearSelection,
    generatorProps: {
      nodes: graph.nodes, graphEmpty, generationMode, startingState, lengthLimit, delimiter, delimiterType,
      fastSimulation,
      onStartingStateChange: handleChangeStartingState,
      onLengthLimitChange: handleChangeLengthLimit,
      onLengthLimitCommit: handleCommitLengthLimit,
      onDelimiterCommit: handleCommitDelimiter,
      onDelimiterTypeChange: handleChangeDelimiterType,
      onDelimiterChange: handleChangeDelimiter,
      onSpeedChange: handleSpeedToggle,
      onPlay: handlePlay,
      onPause: handlePause,
      onResume: handleResume,
      onStep: handleStep,
    },
    outputProps: {
      sequenceGroups, graphEmpty, generationMode, lengthLimit, highlightOutput,
      onToggleHighlight: toggleHighlightOutput,
      onClear: handleClearOutput,
      onCancel: handleCancel,
    },
    view: {
      fitViewAt, recenterViewAt, resetViewAt, graphOpacity,
      onFitView: handleFitView,
      onRecenterView: handleRecenterView,
      onReset: handleReset,
      onDimensions: handleDimensionChange,
      setGraph, setHighlightNode,
      onClearHighlightOutput: handleClearHighlightOutput,
      confirmModal,
      onSelectDatasetMode: handleSelectDatasetMode,
      onSelectDrawingMode: handleSelectDrawingMode,
      onReturnToMainMenu: handleReturnToMainMenu,
    },
  };
};
