import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";

import { useCODAP } from "../hooks/use-codap";
import { useGraph } from "../hooks/use-graph";
import { useGenerator } from "../hooks/use-generator";
import { Edge, GraphData, Node } from "../type";
import { Drawing } from "./drawing";
import { Dataset } from "./dataset";

import StepIcon from "../assets/step.svg";
import PlayIcon from "../assets/play.svg";
import PauseIcon from "../assets/pause.svg";
import DropdownUpArrowIcon from "../assets/dropdown-up-arrow-icon.svg";
import DropdownDownArrowIcon from "../assets/dropdown-down-arrow-icon.svg";
import { SpeedToggle } from "./speed-toggle";

import "./app.scss";

type GenerationMode = "ready" | "playing" | "paused" | "stepping";

const AnyStartingState = "(any)";

const fastAnimationOverride = parseInt((new URLSearchParams(window.location.search)).get("fastSpeed") ?? "", 10);
const normalAnimationOverride = parseInt((new URLSearchParams(window.location.search)).get("normalSpeed") ?? "", 10);

const FastAnimationDelay = isNaN(fastAnimationOverride) ? 250 : fastAnimationOverride;
const NormalAnimationDelay = isNaN(normalAnimationOverride) ? 1000 : normalAnimationOverride;

const defaultLengthLimit = 5;
const defaultDelimiter = " ";
const defaultStartingState = "";
const defaultFastSimulation = false;

type SequenceGroup = {
  startingState: string;
  startingNode: Node | undefined;
  delimiter: string;
  lengthLimit: number;
  sequences: Node[][];
};

const SequenceOutputHeader = ({ group }: { group: SequenceGroup }) => {
  const [expanded, setExpanded] = useState(false);
  const startingState = group.startingNode?.label ?? AnyStartingState;
  const lengthLimit = group.lengthLimit;
  const delimiter = group.delimiter === "" ? "(none)" : `"${group.delimiter}"`;

  const handleToggleExpanded = () => setExpanded(prev => !prev);

  if (expanded) {
    return (
      <div className="header expanded" onClick={handleToggleExpanded}>
        <div className="firstItem">
          <div>Starting State: {startingState}</div>
          <span className="collapse"><DropdownUpArrowIcon /></span>
        </div>
        <div>Max Length: {lengthLimit}</div>
        <div>Delimiter: {delimiter}</div>
      </div>
    );
  }

  return (
    <div className="header collapsed" onClick={handleToggleExpanded}>
      <span>{startingState}</span>
      <span>/</span>
      <span>{lengthLimit}</span>
      <span>/</span>
      <span>{delimiter}</span>
      <span className="expand"><DropdownDownArrowIcon /></span>
    </div>
  );
};

export const App = () => {
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
  const currentAnimatedSequenceGroup = useRef<SequenceGroup>();
  const currentAnimationStep = useRef<"before" | "after">("before");
  const prevSequences = useRef<Node[][]>([]);
  const currentSequence = useRef<Node[]>([]);
  const currentSequenceIndex = useRef(0);
  const animationInterval = useRef<number>();
  const { graph, updateGraph, setGraph } = useGraph();
  const [initialGraph, setInitialGraph] = useState<GraphData>();
  const [fitViewAt, setFitViewAt] = useState<number>();
  const [recenterViewAt, setRecenterViewAt] = useState<number>();
  const onCODAPDataChanged = (values: string[]) => {
    updateGraph(values);
    setFitViewAt(Date.now());
  };
  const widthRef = useRef(0);
  const heightRef = useRef(0);
  const onSetGraph = (data: GraphData, version: number) => {

    const done = () => {
      setGraph(data);
      setFitViewAt(Date.now());
    };

    const translateOrigin = () => {
      if (!widthRef.current || !heightRef.current) {
        setTimeout(translateOrigin, 1);
      } else {
        // the original data was stored with the origin at the top left
        // but now data is stored with the origin in the center
        // so we need to translate the points on load to the center
        const xOffset = -widthRef.current / 2;
        const yOffset = -heightRef.current / 2;
        data.nodes.forEach(n => {
          n.x = (n.x ?? 0) + xOffset;
          n.y = (n.y ?? 0) + yOffset;
        });
        done();
      }
    };

    if (version < 2) {
      translateOrigin();
    } else {
      done();
    }
  };
  const { dragging, outputToDataset, viewMode, setViewMode, notifyStateIsDirty, loadState } = useCODAP({
    onCODAPDataChanged,
    getGraph: useCallback(() => graph, [graph]),
    setGraph: onSetGraph,
    setInitialGraph
  });
  const { generate } = useGenerator();
  const innerOutputRef = useRef<HTMLDivElement | null>(null);
  const [fastSimulation, setFastSimulation] = useState(defaultFastSimulation);
  const fastSimulationRef = useRef(false);
  const [highlightOutput, setHighlightOutput] = useState<{group: SequenceGroup, sequence: Node[]}|undefined>();

  const handleDimensionChange = ({width, height}: {width: number, height: number}) => {
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
      notifyStateIsDirty();
    }
  }, [graph, viewMode, notifyStateIsDirty]);

  useEffect(() => {
    if (innerOutputRef.current && sequenceGroups.length > 0) {
      innerOutputRef.current.scrollTop = innerOutputRef.current.scrollHeight;
    }
  }, [sequenceGroups]);

  const graphEmpty = useMemo(() => graph.nodes.length === 0, [graph]);

  const highlightOutputNodes = useMemo(() => {
    return animating ? undefined : highlightOutput?.sequence;
  }, [animating, highlightOutput]);

  const generateNewSequence = useCallback(async () => {
    currentSequence.current = [];
    currentSequenceIndex.current = 0;

    if (lengthLimit !== undefined) {
      const startingNode = startingState.length > 0 ? graph.nodes.find(n => n.id === startingState) : undefined;

      prevAnimatedSequenceGroups.current = [...sequenceGroups];
      currentAnimatedSequenceGroup.current =
        prevAnimatedSequenceGroups.current[prevAnimatedSequenceGroups.current.length - 1];
      if (!currentAnimatedSequenceGroup.current ||
        (currentAnimatedSequenceGroup.current.delimiter !== delimiter) ||
        (currentAnimatedSequenceGroup.current.lengthLimit !== lengthLimit) ||
        (currentAnimatedSequenceGroup.current.startingState !== startingState)) {
        currentAnimatedSequenceGroup.current = { delimiter, lengthLimit, startingState, startingNode, sequences: [] };
        setSequenceGroups(prevAnimatedSequenceGroups.current);
      } else {
        prevAnimatedSequenceGroups.current.pop();
      }

      prevSequences.current = [...currentAnimatedSequenceGroup.current.sequences];
      // currentAnimatedSequenceGroup.current.sequences.push("");

      currentSequence.current = await generate(graph, { startingNode, lengthLimit });
      currentAnimationStep.current = "before";
    }
  }, [generate, graph, lengthLimit, startingState, sequenceGroups, delimiter]);

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
      await outputToDataset(currentSequence.current);

      if (currentAnimatedSequenceGroup.current) {
        currentAnimatedSequenceGroup.current.sequences = [...prevSequences.current, currentSequence.current];
        setSequenceGroups([...prevAnimatedSequenceGroups.current, currentAnimatedSequenceGroup.current]);
      }
    }

    setGenerationMode("ready");
  }, [outputToDataset]);

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

  const handleChangeDelimiter = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDelimiter(e.target.value);
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
    if (!highlightOutput || (highlightOutput.group !== group) || (highlightOutput.sequence !== sequence)) {
      setHighlightOutput({group, sequence});
    } else {
      setHighlightOutput(undefined);
    }
  }, [highlightOutput, setHighlightOutput, setSelectedNodeId]);

  const uiForGenerate = () => {
    const playLabel = generationMode === "playing" ? "Pause" : (generationMode === "paused" ? "Resume" : "Play");
    const PlayOrPauseIcon = generationMode === "playing" ? PauseIcon : PlayIcon;
    const onPlayClick = generationMode === "playing"
      ? handlePause
      : (generationMode === "paused" ? handleResume : handlePlay);
    const delimiterIsSpace = delimiter === " ";
    const delimiterValue = delimiterIsSpace ? "" : delimiter;
    const delimiterPlaceholder = delimiterIsSpace ? "(space)" : "(none)";
    const sortedNodes = [...graph.nodes];
    sortedNodes.sort((a, b) => a.label.localeCompare(a.label));

    return (
      <div className="generate">
        <div className="flex-col">
          <div>
            <label>Starting State:</label>
            <select onChange={handleChangeStartingState} value={startingState} disabled={animating}>
              <option value="">{AnyStartingState}</option>
              {sortedNodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </div>

          <div className="flex-row">
            <div>
              <label>Max Length:</label>
              <input className="bordered" type="number"
                value={lengthLimit}
                onChange={handleChangeLengthLimit}
                min={1}
                disabled={animating}
              />
            </div>

            <div>
              <label>Delimiter:</label>
              <input className="bordered" type="text"
                onChange={handleChangeDelimiter}
                value={delimiterValue}
                placeholder={delimiterPlaceholder}
                maxLength={3}
                disabled={animating}
              />
            </div>
          </div>

          <SpeedToggle fastSimulation={fastSimulation} onChange={handleSpeedToggle} />

        </div>
        <div className="buttons">
          <button
            type="button"
            onClick={onPlayClick}
            disabled={graphEmpty || lengthLimit === undefined}>
            <PlayOrPauseIcon />
            {playLabel}
          </button>
          <button
            type="button"
            onClick={handleStep}
            disabled={graphEmpty || lengthLimit === undefined || generationMode === "playing"}>
            <StepIcon />
            Step
          </button>
        </div>
      </div>
    );
  };

  const sequenceOutput = () => {
    const disabled = sequenceGroups.length === 0;
    return (
      <div className="sequence-output">
        <label>Output:</label>
        <div className="output">
          <div className="inner-output" ref={innerOutputRef}>
            {sequenceGroups.map((group, i) => {
              return (
                <div className="group" key={i}>
                  <SequenceOutputHeader group={group} />
                  <div className="sequences">
                    {group.sequences.map((s, j) => (
                      <div
                        key={j}
                        className={clsx("sequence", {
                          disabled: animating,
                          highlighted: (
                            highlightOutput && highlightOutput.group === group && highlightOutput.sequence === s
                          )
                        })}
                        onClick={animating ? undefined : () => toggleHighlightOutput(group, s)}
                      >
                        {s.map(n => n.label).join(group.delimiter)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="buttons">
          <button
            type="button"
            onClick={handleClearOutput}
            disabled={disabled || lengthLimit === undefined || generationMode !== "ready"}>
            Clear Output
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={graphEmpty || (generationMode === "ready")}>
            Cancel
          </button>
        </div>
      </div>
    );
  };

  const handleSelectDatasetMode = () => {
    setViewMode("dataset");
    notifyStateIsDirty();
  };

  const handleSelectDrawingMode = () => {
    setViewMode("drawing");
    notifyStateIsDirty();
  };

  const handleReset = useCallback(() => {
    if (confirm("Are you sure you want to reset?\n\nAny changes you have made will be lost.")) {
      setLengthLimit(defaultLengthLimit);
      setDelimiter(defaultDelimiter);
      setStartingState(defaultStartingState);
      setSequenceGroups([]);
      setFastSimulation(defaultFastSimulation);
      setGraph(initialGraph ? {...initialGraph} : {nodes: [], edges: []});
      setFitViewAt(Date.now());
    }
  }, [initialGraph, setGraph]);

  const handleReturnToMainMenu = () => {
    if (confirm("Are you sure you want to go back to the main menu?\n\nAny changes you have made will be lost.")) {
      setGraph({nodes: [], edges: []});
      setInitialGraph(undefined);
      setViewMode(undefined);
    }
  };

  const handleFitView = () => {
    setFitViewAt(Date.now());
  };

  const handleRecenterView = () => {
    setRecenterViewAt(Date.now());
  };

  if (loadState === "loading") {
    return <div className="loading">Loading ...</div>;
  }

  if (!viewMode) {
    return (
      <div className={clsx("app")}>
        <div className="instructions">
          <h2>Select Mode</h2>
          <div className="select-view-mode">
            <div>
              <button onClick={handleSelectDatasetMode}>Dataset</button>
              <div>
                Use existing data to generate a Markov Chain.
              </div>
            </div>
            <div>
              <button onClick={handleSelectDrawingMode}>Drawing</button>
              <div>
                Create a Markov Chain by dragging and dropping elements.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const maybeRenderRightBar = () => {
    if (viewMode === "dataset" && graphEmpty) {
      return;
    }

    return (
      <div className="right">
        {uiForGenerate()}
        {sequenceOutput()}
      </div>
    );
  };

  return (
    <div className={clsx("app", { dragging })}>
      <div className="split">
        <div className="left">
          {viewMode === "drawing"
            ?
              <Drawing
                graph={graph}
                highlightNode={highlightNode}
                highlightLoopOnNode={highlightLoopOnNode}
                highlightEdge={highlightEdge}
                highlightAllNextNodes={highlightAllNextNodes}
                highlightOutputNodes={highlightOutputNodes}
                selectedNodeId={selectedNodeId}
                animating={animating}
                setGraph={setGraph}
                setHighlightNode={setHighlightNode}
                setSelectedNodeId={setSelectedNodeId}
                onReset={handleReset}
                onReturnToMainMenu={handleReturnToMainMenu}
                onFitView={handleFitView}
                onRecenterView={handleRecenterView}
                fitViewAt={fitViewAt}
                recenterViewAt={recenterViewAt}
                onDimensions={handleDimensionChange}
              />
            :
              <Dataset
                graph={graph}
                highlightNode={highlightNode}
                highlightLoopOnNode={highlightLoopOnNode}
                highlightEdge={highlightEdge}
                highlightAllNextNodes={highlightAllNextNodes}
                highlightOutputNodes={highlightOutputNodes}
                selectedNodeId={selectedNodeId}
                animating={animating}
                graphEmpty={graphEmpty}
                setSelectedNodeId={setSelectedNodeId}
                onReset={handleReset}
                onReturnToMainMenu={handleReturnToMainMenu}
                onFitView={handleFitView}
                onRecenterView={handleRecenterView}
                fitViewAt={fitViewAt}
                recenterViewAt={recenterViewAt}
                onDimensions={handleDimensionChange}
              />
          }
        </div>
        {maybeRenderRightBar()}
      </div>
    </div>
  );
};
