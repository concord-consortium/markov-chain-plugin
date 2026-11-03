import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useGraph } from "./use-graph";
import { DelimiterType, Edge, GenerationMode, GraphData, Node, SequenceGroup } from "../type";
import { GeneratorProps } from "../components/generator";
import { SequenceOutputProps } from "../components/sequence-output";
import { IConfirmModal } from "../components/confirm-modal";
import { clampLengthLimit, graphToRestore } from "../components/app-utils";
import { generateSequence } from "../utils/generate-sequence";
import { moveOriginToCenter } from "../utils/plugin-state";
import { MarkovHost, MarkovToolHandle } from "../components/host";

const fastAnimationOverride = parseInt((new URLSearchParams(window.location.search)).get("fastSpeed") ?? "", 10);
const normalAnimationOverride = parseInt((new URLSearchParams(window.location.search)).get("normalSpeed") ?? "", 10);

const FastAnimationDelay = isNaN(fastAnimationOverride) ? 250 : fastAnimationOverride;
const NormalAnimationDelay = isNaN(normalAnimationOverride) ? 1000 : normalAnimationOverride;

const defaultLengthLimit = 5;
const defaultDelimiter = " ";
const defaultStartingState = "";
const defaultFastSimulation = false;

// The Markov tool's state and handlers, apart from any layout: MarkovTool lays them out for the CODAP plugin.
export interface MarkovToolApi {
  handle: MarkovToolHandle;
  graph: GraphData;
  graphEmpty: boolean;
  animating: boolean;
  // what the graph draws: the animation's highlights and the chosen state or output
  graphHighlights: {
    highlightNode?: Node, highlightLoopOnNode?: Node, highlightEdge?: Edge, highlightAllNextNodes: boolean,
    highlightOutputNodes?: Node[], selectedNodeId?: string,
  };
  setSelectedNodeId: (id?: string, skipToggle?: boolean) => void;
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
  const { viewMode, setViewMode, markDirty, outputSequence } = host;
  const [lengthLimit, setLengthLimit] = useState<number | undefined>(defaultLengthLimit);
  const [delimiter, setDelimiter] = useState(defaultDelimiter);
  const [startingState, setStartingState] = useState(defaultStartingState);
  const [sequenceGroups, setSequenceGroups] = useState<SequenceGroup[]>([]);
  const [selectedNodeId, _setSelectedNodeId] = useState<string>();
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
  const onDataChanged = useCallback((values: string[]) => {
    datasetValuesRef.current = values;
    updateGraph(values);
    fitAfterGraphChangeRef.current = true;
  }, [updateGraph]);
  const widthRef = useRef(0);
  const heightRef = useRef(0);
  const onSetGraph = useCallback((data: GraphData, version: number) => {

    const done = () => {
      setGraph(data);
      fitAfterGraphChangeRef.current = true;
    };

    const translateOrigin = () => {
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
      if ((!id || (id === selectedNodeId)) && !skipToggle) {
        _setSelectedNodeId(undefined);
      } else {
        _setSelectedNodeId(id);
      }
    }
  }, [_setSelectedNodeId, selectedNodeId, animating]);

  useEffect(() => {
    if (viewMode === "drawing") {
      markDirty();
    }
  }, [graph, viewMode, markDirty]);

  const graphEmpty = useMemo(() => graph.nodes.length === 0, [graph]);

  const highlightOutputNodes = useMemo(() => {
    return animating ? undefined : highlightOutput?.sequence;
  }, [animating, highlightOutput]);

  const generateNewSequence = useCallback(async () => {
    currentSequence.current = [];
    currentSequenceIndex.current = 0;

    const limit = clampLengthLimit(lengthLimit);
    if (limit !== undefined) {
      const startingNode = startingState.length > 0 ? graph.nodes.find(n => n.id === startingState) : undefined;

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

  const finishAnimating = useCallback(async (cancel?: boolean) => {
    setHighlightNode(undefined);
    setHighlightEdge(undefined);
    setHighlightLoopOnNode(undefined);
    stopAnimationInterval();

    if (!cancel) {
      await outputSequence(currentSequence.current.map(state => state.label));

      if (currentAnimatedSequenceGroup.current) {
        currentAnimatedSequenceGroup.current.sequences = [...prevSequences.current, currentSequence.current];
        setSequenceGroups([...prevAnimatedSequenceGroups.current, currentAnimatedSequenceGroup.current]);
      }
    }

    setGenerationMode("ready");
  }, [outputSequence]);

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

  const handleCommitLengthLimit = () => setLengthLimit(prev => clampLengthLimit(prev));

  const handleChangeDelimiter = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDelimiter(e.target.value);
  };

  const handleChangeDelimiterType = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as DelimiterType;
    setDelimiterType(newType);
    switch (newType) {
      case "space":
        setDelimiter(" ");
        break;
      case "none":
      case "other":
        setDelimiter("");
        break;
    }
  };

  const handleChangeStartingState = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStartingState(e.target.value);
  };

  const handleClearOutput = useCallback(() => {
    setSequenceGroups([]);
  }, []);

  const handlePause = useCallback(() => {
    setGenerationMode("paused");
    stopAnimationInterval();
  }, []);

  const handleResume = useCallback(async () => {
    if (currentSequenceAnimating()) {
      setGenerationMode("playing");
      startAnimationInterval();
    } else {
      await finishAnimating();
    }
  }, [finishAnimating, startAnimationInterval]);

  const handleStep = useCallback(async () => {
    setHighlightOutput(undefined);
    if ((generationMode !== "stepping") && (generationMode !== "paused")) {
      setGenerationMode("stepping");
      await generateNewSequence();
      animateCurrentSequenceIndex();
    } else if (currentSequenceAnimating()) {
      animateNextSequenceIndex();
    } else {
      await finishAnimating();
    }
  }, [generationMode, animateCurrentSequenceIndex, animateNextSequenceIndex, finishAnimating, generateNewSequence]);

  const handlePlay = useCallback(async () => {
    setHighlightOutput(undefined);
    setGenerationMode("playing");
    await generateNewSequence();
    animateCurrentSequenceIndex();
    startAnimationInterval();
  }, [generateNewSequence, animateCurrentSequenceIndex, startAnimationInterval]);

  const handleSpeedToggle = useCallback((value: boolean) => {
    setFastSimulation(value);
    fastSimulationRef.current = value;
  }, [setFastSimulation]);

  const handleCancel = () => {
    finishAnimating(true);
  };

  const toggleHighlightOutput = useCallback((group: SequenceGroup, sequence: Node[]) => {
    setSelectedNodeId();
    if ((highlightOutput?.group !== group) || (highlightOutput.sequence !== sequence)) {
      setHighlightOutput({ group, sequence });
    } else {
      setHighlightOutput(undefined);
    }
  }, [highlightOutput, setHighlightOutput, setSelectedNodeId]);

  const handleClearHighlightOutput = () => setHighlightOutput(undefined);

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
        setLengthLimit(defaultLengthLimit);
        setDelimiter(defaultDelimiter);
        setStartingState(defaultStartingState);
        setSequenceGroups([]);
        setFastSimulation(defaultFastSimulation);
        setGraphOpacity(0);
        setSelectedNodeId();
        setGraph({ nodes: [], edges: [] });
        setResetViewAt(Date.now());
        setTimeout(() => {
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
  }, [viewMode, initialGraph, setGraph, setSelectedNodeId]);

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
    },
    setSelectedNodeId,
    generatorProps: {
      nodes: graph.nodes, graphEmpty, generationMode, startingState, lengthLimit, delimiter, delimiterType,
      fastSimulation,
      onStartingStateChange: handleChangeStartingState,
      onLengthLimitChange: handleChangeLengthLimit,
      onLengthLimitCommit: handleCommitLengthLimit,
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
