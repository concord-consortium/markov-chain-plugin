import React, { useCallback, useState } from "react";
import {clsx} from "clsx";

import { useCODAP } from "../hooks/use-codap";
import { useGraph } from "../hooks/use-graph";
import { Graph } from "./graph";
import { useGenerator } from "../hooks/use-generator";
import { Node } from "../type";

import "./app.scss";

type Destination = "text component" | "dataset";

const AnyStartingState = "(any)";
const MaxLengthLimit = 25;

export const App = () => {
  const [destination, setDestination] = useState<Destination>("text component");
  const [lengthLimit, setLengthLimit] = useState<number|undefined>(5);
  const [delimiter, setDelimiter] = useState("");
  const [startingState, setStartingState] = useState("");
  const [textSequenceHeader, setTextSequenceHeader] = useState("");
  const [animateNode, setAnimateNode] = useState<Node|undefined>(undefined);
  const [generating, setGenerating] = useState(false);

  const {graph, updateGraph} = useGraph();
  const {dragging, outputToDataset, outputTextSequence} = useCODAP({onCODAPDataChanged: updateGraph});
  const {generate} = useGenerator();

  const graphEmpty = useCallback(() => graph.nodes.length === 0, [graph]);

  const instructions = () => {
    if (graphEmpty()) {
      return (
        <div className="instructions">
          <p>
            This plugin generates sequences of text using a Markov chain. The plugin uses a Markov chain built from a
            dataset in CODAP. The dataset must have a column of states. The plugin will build a Markov chain from the
            states, and then allow generation of a sequence of text using the Markov chain.
          </p>
          <p>
            To use the plugin, first drag an attribute into the plugin.
          </p>
        </div>
      );
    }
  };

  const handleChangeDestination = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDestination(e.target.value as Destination);
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

  const generateSequenceHeader = () => {
    const parts = [
      `starting state: ${startingState.length > 0 ? startingState : AnyStartingState}`,
      `delimiter: ${delimiter === "" ? "(none)" : `"${delimiter}"`}`,
      `max length: ${lengthLimit}`
    ];
    return `---- ${parts.join(", ")} ----`;
  };

  const handleGenerate = useCallback(async () => {
    if (lengthLimit !== undefined) {
      let newTextSequenceHeader: string|undefined;
      const startingNode = startingState.length > 0 ? graph.nodes.find(n => n.id === startingState) : undefined;

      setGenerating(true);

      const generatedResult = await generate(graph, {startingNode, lengthLimit});
      const sequence = generatedResult.map(n => n.label);

      if (destination === "text component") {
        newTextSequenceHeader = generateSequenceHeader();
        if (newTextSequenceHeader === textSequenceHeader) {
          newTextSequenceHeader = undefined;
        }
      }

      await outputTextSequence("append", "", newTextSequenceHeader);

      await animateNodes(generatedResult, async (animatedNodes) => {
        await outputTextSequence(
          "replace",
          animatedNodes.map(node => node.label).join(delimiter),
          newTextSequenceHeader
        );
      });

      setGenerating(false);

      switch (destination) {
        case "text component":
          if (newTextSequenceHeader) {
            setTextSequenceHeader(newTextSequenceHeader);
          }
          await outputTextSequence("replace", sequence.join(delimiter), newTextSequenceHeader);
          break;
        case "dataset":
          await outputToDataset(sequence);
          break;
      }
    }
  }, [delimiter, destination, generate, generateSequenceHeader, graph, lengthLimit, outputTextSequence, outputToDataset, startingState, textSequenceHeader]);

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
          <div>
            <div>Where to put generated states</div>
            <div>
              <input
                type="radio"
                name="destinationInput"
                value={"text component"}
                checked={destination === "text component"}
                onChange={handleChangeDestination} /> Text Component
              <input
                type="radio"
                name="destinationInput"
                value={"dataset"}
                checked={destination === "dataset"}
                onChange={handleChangeDestination} /> Dataset
            </div>
          </div>
          <div className="flex-row">
          <label> Starting State:
            <select onChange={handleChangeStartingState} value={startingState}>
              <option value="">{AnyStartingState}</option>
              {graph.nodes.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
            </select>
          </label>
          <label> Max Length:
            <input type="number"
                   value={lengthLimit}
                   onChange={handleChangeLengthLimit}
                   min={1}
                   max={MaxLengthLimit}
                   style={{width: "50px"}}
            />
          </label>
          {destination === "text component" &&
            <label>Delimiter:
              <input type="text"
                     onChange={handleChangeDelimiter}
                     value={delimiter}
                     maxLength={3}
                     style={{width: "20px"}}
              />
            </label>}
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={lengthLimit === undefined || generating}>
              Generate
          </button>
        </div>
      );
    }
  };

  return (
    <div className={clsx("app", {dragging})}>
      <h2>Markov Chains</h2>
      {instructions()}
      {uiForGenerate()}
      <Graph graph={graph} animateNode={animateNode} />
    </div>
  );
};

