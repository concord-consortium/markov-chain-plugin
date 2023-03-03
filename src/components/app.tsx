import React, { useCallback, useEffect, useRef, useState } from "react";
import {clsx} from "clsx";

import { useCODAP } from "../hooks/use-codap";
import { useGraph } from "../hooks/use-graph";
import { Graph } from "./graph";
import { useGenerator } from "../hooks/use-generator";
import { Node } from "../type";

import "./app.scss";

type GenerationMode = "ready" | "playing" | "paused" | "steping";

const AnyStartingState = "(any)";
const MaxLengthLimit = 25;

type SequenceGroup = {
  startingState: string;
  delimiter: string;
  lengthLimit: number;
  sequences: string[];
};

export const App = () => {
  const [lengthLimit, setLengthLimit] = useState<number|undefined>(5);
  const [delimiter, setDelimiter] = useState("");
  const [startingState, setStartingState] = useState("");
  const [sequenceGroups, setSequenceGroups] = useState<SequenceGroup[]>([]);
  const [animateNode, setAnimateNode] = useState<Node|undefined>(undefined);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("ready");
  const prevAnimatedSequenceGroups = useRef<SequenceGroup[]>([]);
  const currentAnimatedSequenceGroup = useRef<SequenceGroup>();

  const {graph, updateGraph} = useGraph();
  const {dragging, outputToDataset} = useCODAP({onCODAPDataChanged: updateGraph});
  const {generate} = useGenerator();
  const innerOutputRef = useRef<HTMLDivElement|null>(null);

  useEffect(() => {
    if (innerOutputRef.current && sequenceGroups.length > 0) {
      innerOutputRef.current.scrollTop = innerOutputRef.current.scrollHeight;
    }
  }, [sequenceGroups]);

  const graphEmpty = useCallback(() => graph.nodes.length === 0, [graph]);

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

  const handlePause = () => {
    // TODO
  };

  const handleStep = () => {
    // TODO
  };

  const handleClear = () => {
    // TODO
  };

  const handleGenerate = useCallback(async () => {
    if (lengthLimit !== undefined) {
      //let newTextSequenceHeader: string|undefined;
      const startingNode = startingState.length > 0 ? graph.nodes.find(n => n.id === startingState) : undefined;

      setGenerationMode("playing");

      const generatedResult = await generate(graph, {startingNode, lengthLimit});
      const sequence = generatedResult.map(n => n.label);

      prevAnimatedSequenceGroups.current = [...sequenceGroups];
      currentAnimatedSequenceGroup.current =
        prevAnimatedSequenceGroups.current[prevAnimatedSequenceGroups.current.length - 1];
      if (!currentAnimatedSequenceGroup.current ||
          (currentAnimatedSequenceGroup.current.delimiter !== delimiter) ||
          (currentAnimatedSequenceGroup.current.lengthLimit !== lengthLimit) ||
          (currentAnimatedSequenceGroup.current.startingState !== startingState)) {
        currentAnimatedSequenceGroup.current = {delimiter, lengthLimit, startingState, sequences: []};
        setSequenceGroups(prevAnimatedSequenceGroups.current);
      } else {
        prevAnimatedSequenceGroups.current.pop();
      }

      const prevSequences = [...currentAnimatedSequenceGroup.current.sequences];
      currentAnimatedSequenceGroup.current.sequences.push("");

      await animateNodes(generatedResult, async (animatedNodes) => {
        if (currentAnimatedSequenceGroup.current) {
          const animatedSequence = animatedNodes.map(node => node.label).join(delimiter);
          currentAnimatedSequenceGroup.current.sequences = [...prevSequences, animatedSequence];
          setSequenceGroups([...prevAnimatedSequenceGroups.current, currentAnimatedSequenceGroup.current]);
        }
      });

      setGenerationMode("ready");

      currentAnimatedSequenceGroup.current.sequences = [...prevSequences, sequence.join(delimiter)];
      setSequenceGroups([...prevAnimatedSequenceGroups.current, currentAnimatedSequenceGroup.current]);

      await outputToDataset(sequence);
    }
  }, [generate, graph, lengthLimit, outputToDataset, startingState, sequenceGroups, delimiter]);

  const animateNodes = (nodes: Node[], callback: (animatedNodes: Node[]) => void) => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise<void>(async (resolve) => {
      const newNodes = [...nodes];
      let node = newNodes.shift();
      const animatedNodes: Node[] = node ? [node] : [];
      setAnimateNode(node);
      await callback(animatedNodes);

      const interval = setInterval(async () => {
        node = newNodes.shift();
        setAnimateNode(node);
        if (node) {
          animatedNodes.push(node);
          await callback(animatedNodes);
        } else {
          clearInterval(interval);
          resolve();
        }
      }, 250);
    });
  };

  const uiForGenerate = () => {
    if (!graphEmpty()) {
      return (
        <div className="generate">
          <div className="flex-col">
            <div>
              <label>Starting State:</label>
              <select onChange={handleChangeStartingState} value={startingState}>
                <option value="">{AnyStartingState}</option>
                {graph.nodes.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
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
                />
              </div>

              <div>
                <label>Delimiter:</label>
                <input type="text"
                        onChange={handleChangeDelimiter}
                        value={delimiter}
                        placeholder="(none)"
                        maxLength={3}
                />
              </div>
            </div>
          </div>
          <div className="buttons">
            <button
              type="button"
              onClick={generationMode === "playing" ? handlePause : handleGenerate}
              disabled={lengthLimit === undefined || generationMode === "steping"}>
                {generationMode === "playing" ? "Pause": "Play"}
            </button>
            <button
              type="button"
              onClick={handleStep}
              disabled={lengthLimit === undefined || generationMode === "playing"}>
                Step
            </button>
          </div>
        </div>
      );
    }
  };

  const sequenceOutput = () => {
    return (
      <div className="sequence-output">
        <div className="output">
          <div className="inner-output" ref={innerOutputRef}>
            {sequenceGroups.map((group, i) => {
              return (
                <div className="group" key={i}>
                  <div className="header">
                    <span>{group.startingState.length > 0 ? group.startingState : AnyStartingState}</span>
                    <span>/</span>
                    <span>{group.lengthLimit}</span>
                    <span>/</span>
                    <span>{group.delimiter === "" ? "(none)" : `"${group.delimiter}"`}</span>
                  </div>
                  <div className="sequences">
                    {group.sequences.map((s, j) => <div key={j}>{s}</div>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="buttons">
          <button
            type="button"
            onClick={handleClear}
            disabled={lengthLimit === undefined}>
              Clear Output
          </button>
        </div>
      </div>
    );
  };

  if (graphEmpty()) {
    return (
      <div className={clsx("app", {dragging})}>
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
    <div className={clsx("app", {dragging})}>
      <div className="split">
        <div className="left">
          <h2>Markov Chains</h2>
          <Graph graph={graph} animateNode={animateNode} />
        </div>
        <div className="right">
          {uiForGenerate()}
          {sequenceOutput()}
        </div>
      </div>
    </div>
  );
};

