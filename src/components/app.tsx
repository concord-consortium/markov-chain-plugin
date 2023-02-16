import React, { useCallback, useState } from "react";
import {clsx} from "clsx";

import { useCODAP } from "../hooks/use-codap";
import { useGraph } from "../hooks/use-graph";
import { Graph } from "./graph";
import { useGenerator } from "../hooks/use-generator";

import "./app.scss";

type Destination = "text component" | "dataset";

const AnyStartingState = "(any)";

export const App = () => {
  const [destination, setDestination] = useState<Destination>("text component");
  const [lengthLimit, setLengthLimit] = useState<number|undefined>(5);
  const [delimiter, setDelimiter] = useState("");
  const [startingState, setStartingState] = useState("");
  const [textSequenceHeader, setTextSequenceHeader] = useState("");

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
    setLengthLimit(isNaN(numberValue) ? undefined : numberValue);
  };

  const handleChangeDelimiter = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDelimiter(e.target.value);
  };

  const handleChangeStartingState = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStartingState(e.target.value);
  };

  const handleGenerate = async () => {
    if (lengthLimit !== undefined) {
      const startingNode = startingState.length > 0 ? graph.nodes.find(n => n.id === startingState) : undefined;
      const generatedResult = await generate(graph, {startingNode, lengthLimit});
      let newTextSequenceHeader: string|undefined;

      switch (destination) {
        case "text component":
          // eslint-disable-next-line max-len
          newTextSequenceHeader = `---- starting state: ${startingState.length > 0 ? startingState : AnyStartingState}, max length: ${lengthLimit} ----`;
          if (newTextSequenceHeader === textSequenceHeader) {
            newTextSequenceHeader = undefined;
          } else {
            setTextSequenceHeader(newTextSequenceHeader);
          }
          await outputTextSequence(generatedResult.join(delimiter), newTextSequenceHeader);
          break;
        case "dataset":
          await outputToDataset(generatedResult);
          break;
      }
    }
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
                   max={99999}
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
          <button type="button" onClick={handleGenerate} disabled={lengthLimit === undefined}>Generate</button>
        </div>
      );
    }
  };

  return (
    <div className={clsx("app", {dragging})}>
      <h2>Markov Chains</h2>
      {instructions()}
      {uiForGenerate()}
      <Graph graph={graph} />
    </div>
  );
};
