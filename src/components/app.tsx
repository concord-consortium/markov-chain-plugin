import React, { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

import { useCODAP } from "../hooks/use-codap";
import { useGraph } from "../hooks/use-graph";
import { Graph, orangeColor } from "./graph";
import { useGenerator } from "../hooks/use-generator";
import { Edge, Node } from "../type";
import { Drawing } from "./drawing";

import "./app.scss";

type GenerationMode = "ready" | "playing" | "paused" | "stepping";

const AnyStartingState = "(any)";
const MaxLengthLimit = 25;
const AnimationDelay = 1000;

type SequenceGroup = {
  startingState: string;
  delimiter: string;
  lengthLimit: number;
  sequences: Node[][];
};

const SequenceOutputHeader = ({ group }: { group: SequenceGroup }) => {
  const [expanded, setExpanded] = useState(false);
  const startingState = group.startingState.length > 0 ? group.startingState : AnyStartingState;
  const lengthLimit = group.lengthLimit;
  const delimiter = group.delimiter === "" ? "(none)" : `"${group.delimiter}"`;

  const handleToggleExpanded = () => setExpanded(prev => !prev);

  if (expanded) {
    return (
      <div className="header expanded" onClick={handleToggleExpanded}>
        <div>Starting State: {startingState}</div>
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
      <span className="expand">&hellip;</span>
    </div>
  );
};

export const App = () => {
  const [lengthLimit, setLengthLimit] = useState<number | undefined>(5);
  const [delimiter, setDelimiter] = useState("");
  const [startingState, setStartingState] = useState("");
  const [sequenceGroups, setSequenceGroups] = useState<SequenceGroup[]>([]);
  const [highlightNode, setHighlightNode] = useState<Node>();
  const [highlightLoopOnNode, setHighlightLoopOnNode] = useState<Node>();
  const [highlightEdge, setHighlightEdge] = useState<Edge>();
  const [highlightAllNextNodes, setHighlightAllNextNodes] = useState(false);
  const [highlightColor, setHighlightColor] = useState(orangeColor);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("ready");
  const prevAnimatedSequenceGroups = useRef<SequenceGroup[]>([]);
  const currentAnimatedSequenceGroup = useRef<SequenceGroup>();
  const currentAnimationStep = useRef<"before" | "after">("before");
  const prevSequences = useRef<Node[][]>([]);
  const currentSequence = useRef<Node[]>([]);
  const currentSequenceIndex = useRef(0);
  const animationInterval = useRef<number>();
  const { graph, updateGraph, setGraph } = useGraph();
  const { dragging, outputToDataset, viewMode, setViewMode, notifyStateIsDirty, loadState } = useCODAP({
    onCODAPDataChanged: updateGraph,
    getGraph: useCallback(() => graph, [graph]),
    setGraph
  });
  const { generate } = useGenerator();
  const innerOutputRef = useRef<HTMLDivElement | null>(null);

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

  const graphEmpty = useCallback(() => graph.nodes.length === 0, [graph]);

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
        currentAnimatedSequenceGroup.current = { delimiter, lengthLimit, startingState, sequences: [] };
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
      setHighlightColor(orangeColor);
      // highlight all the possible edges if we have a next node
      setHighlightAllNextNodes(!!nextNode);
      setHighlightLoopOnNode(currentNode);
    } else {
      const edge = nextNode
      ? graph.edges.find(e => e.from === currentNode.id && e.to === nextNode.id)
      : undefined;
      setHighlightEdge(edge);
      setHighlightNode(nextNode);
      setHighlightColor(orangeColor);
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

  const finishAnimating = useCallback(async () => {
    setHighlightNode(undefined);
    setHighlightEdge(undefined);
    setHighlightLoopOnNode(undefined);
    stopAnimationInterval();

    await outputToDataset(currentSequence.current);

    if (currentAnimatedSequenceGroup.current) {
      currentAnimatedSequenceGroup.current.sequences = [...prevSequences.current, currentSequence.current];
      setSequenceGroups([...prevAnimatedSequenceGroups.current, currentAnimatedSequenceGroup.current]);
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
    animationInterval.current = window.setInterval(() => {
      if (currentSequenceAnimating()) {
        animateNextSequenceIndex();
      } else {
        finishAnimating();
      }
    }, AnimationDelay);
  }, [animateNextSequenceIndex, finishAnimating]);

  const stopAnimationInterval = () => {
    window.clearInterval(animationInterval.current);
  };

  const handleChangeLengthLimit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numberValue = parseInt(e.target.value, 10);
    setLengthLimit(isNaN(numberValue) ? undefined : Math.min(MaxLengthLimit, numberValue));
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
    setGenerationMode("playing");
    await generateNewSequence();
    animateCurrentSequenceIndex();
    startAnimationInterval();
  }, [generateNewSequence, animateCurrentSequenceIndex, startAnimationInterval]);

  const uiForGenerate = () => {
    const disabled = graphEmpty();
    const playLabel = generationMode === "playing" ? "Pause" : (generationMode === "paused" ? "Resume" : "Play");
    const onPlayClick = generationMode === "playing"
      ? handlePause
      : (generationMode === "paused" ? handleResume : handlePlay);

    return (
      <div className="generate">
        <div className="flex-col">
          <div>
            <label>Starting State:</label>
            <select onChange={handleChangeStartingState} value={startingState} disabled={disabled}>
              <option value="">{AnyStartingState}</option>
              {graph.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </div>

          <div className="flex-row">
            <div>
              <label>Max Length:</label>
              <input type="number"
                value={lengthLimit}
                onChange={handleChangeLengthLimit}
                min={1}
                max={MaxLengthLimit}
                disabled={disabled}
              />
            </div>

            <div>
              <label>Delimiter:</label>
              <input type="text"
                onChange={handleChangeDelimiter}
                value={delimiter}
                placeholder="(none)"
                maxLength={3}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
        <div className="buttons">
          <button
            type="button"
            onClick={onPlayClick}
            disabled={disabled || lengthLimit === undefined || generationMode === "stepping"}>
            {playLabel}
          </button>
          <button
            type="button"
            onClick={handleStep}
            disabled={disabled || lengthLimit === undefined || generationMode === "playing"}>
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
        <div className="output">
          <div className="inner-output" ref={innerOutputRef}>
            {sequenceGroups.map((group, i) => {
              return (
                <div className="group" key={i}>
                  <SequenceOutputHeader group={group} />
                  <div className="sequences">
                    {group.sequences.map((s, j) => <div key={j}>{s.map(n => n.label).join(group.delimiter)}</div>)}
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

  if (graphEmpty() && viewMode === "dataset") {
    return (
      <div className={clsx("app", { dragging })}>
        <div className="instructions">
          <h2>Markov Chains</h2>
          <p>
            This plugin generates sequences of text using a Markov chain. The plugin uses a Markov chain built from a
            dataset in CODAP. The dataset must have a column of states. The plugin will build a Markov chain from the
            states, and then allow generation of a sequence of text using the Markov chain.
          </p>
          <p>
            To use the plugin, first drag an attribute into the plugin.
          </p>
        </div>
      </div>
    );
  }

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
                highlightColor={highlightColor}
                highlightAllNextNodes={highlightAllNextNodes}
                setGraph={setGraph}
                setHighlightNode={setHighlightNode}
              />
            :
              <Graph
              mode="dataset"
              graph={graph}
              highlightNode={highlightNode}
              highlightLoopOnNode={highlightLoopOnNode}
              highlightEdge={highlightEdge}
              highlightColor={highlightColor}
              highlightAllNextNodes={highlightAllNextNodes}
              allowDragging={true}
              autoArrange={true}
            />
          }
        </div>
        <div className="right">
          {uiForGenerate()}
          {sequenceOutput()}
        </div>
      </div>
    </div>
  );
};
