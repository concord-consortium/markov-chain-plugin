import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Edge, GraphData, Node } from "../type";
import {
  // entityInfo,
  // getNumChildAttributesInContext,
  initializePlugin,
  registerObservers
} from "../utils/codap-helper";
import codapInterface from "../utils/codap-interface";
import pkg from "../../package.json";
import { getAttributeValues } from "../utils/attribute-values";
import { createSequenceOutput } from "../utils/output-dataset";
import { pluginStateValues, readPluginState } from "../utils/plugin-state";

const PluginName = "Markov Chain";
const PluginVersion = pkg.version;
const InitialDimensions = {
  width: 600,
  height: 420
};

export type CODAPAttribute = {
  datasetName: string;
  collectionName: string;
  attributeName: string;
};

export type OnCODAPDataChanged = (values: string[]) => void;
export type GetGraphCallback = () => GraphData;

export type ViewMode = "dataset"|"drawing";
export type OutputTextMode = "replace"|"append";

export type UseCODAPOptions = {
  onCODAPDataChanged: OnCODAPDataChanged;
  getGraph: GetGraphCallback;
  setGraph: (data: GraphData, version: number) => void;
  setInitialGraph: React.Dispatch<React.SetStateAction<GraphData|undefined>>
};

export const useCODAP = ({ onCODAPDataChanged, getGraph, setGraph, setInitialGraph }: UseCODAPOptions) => {
  const [loadState, setLoadState] = useState<"loading"|"loaded">("loading");
  const [initialized, setInitialized] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [attribute, setAttribute] = useState<CODAPAttribute|undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode|undefined>();
  const valuesRef = useRef<string[]>();

  const getPluginState = useCallback(() => ({
    success: true,
    values: pluginStateValues(viewMode, attribute, getGraph)
  }), [attribute, viewMode, getGraph]);

  const notifyStateIsDirty = async () => {
    await codapInterface.sendRequest([{
      action: "notify",
      resource: "interactiveFrame",
      values: {
        dirty: true
      }
    }]);
  };

  const handleDataChanged = useCallback(async (codapAttribute: CODAPAttribute, viewModeOverride?: ViewMode ) => {
    const { datasetName, collectionName, attributeName } = codapAttribute;
    const values = await getAttributeValues(request => codapInterface.sendRequest(request),
      datasetName, collectionName, attributeName);
    if (!values) {
      return;
    }
    const valuesChanged = !valuesRef.current || (JSON.stringify(values) !== JSON.stringify(valuesRef.current));
    const currentViewMode = viewModeOverride ?? viewMode;
    if (currentViewMode === "dataset" && valuesChanged) {
      onCODAPDataChanged(values);
      valuesRef.current = values;
    }
  }, [onCODAPDataChanged, viewMode]);

  const setPluginState = useCallback((values: any) => {
    setLoadState("loaded");

    const saved = readPluginState(values);
    if (saved.viewMode) {
      setViewMode(saved.viewMode);

      if (saved.drawing) {
        const { nodes, edges } = saved.drawing.graph;
        setGraph(saved.drawing.graph, saved.drawing.version);
        // save a copy of the graph
        setInitialGraph({ nodes: nodes.map((n: Node) => ({ ...n })), edges: edges.map((e: Edge) => ({ ...e })) });
      } else if (saved.attribute) {
        setAttribute(saved.attribute);
        handleDataChanged(saved.attribute, saved.viewMode);
      }
    }
  }, [setAttribute, handleDataChanged, setGraph, setInitialGraph]);

  const handleDrop = useCallback(async (iMessage: any) => {
    let newAttribute: CODAPAttribute;

    if (viewMode !== "dataset") {
      return;
    }

    switch (iMessage.values.operation) {
      case "dragstart":
        setDragging(true);
        break;

      case "dragend":
        setDragging(false);
        break;

      case "drop":
        newAttribute = {
          datasetName: iMessage.values.context.name,
          collectionName: iMessage.values.collection.name,
          attributeName: iMessage.values.attribute.name
        };
        valuesRef.current = [];
        setAttribute(newAttribute);
        await handleDataChanged(newAttribute);
        await notifyStateIsDirty();
        break;
    }
  }, [setDragging, setAttribute, handleDataChanged, viewMode]);

  const handleCasesChanged = useCallback(async () => {
    if (attribute) {
      await handleDataChanged(attribute);
    }
  }, [attribute, handleDataChanged]);

  const outputToDataset = useMemo(() => {
    const outputSequence = createSequenceOutput(request => codapInterface.sendRequest(request));
    return (sequence: Node[]) => outputSequence(sequence.map(state => state.label));
  }, []);

  useEffect(() => {
    codapInterface.on("update", "interactiveState", "", setPluginState);
    codapInterface.on("get", "interactiveState", "", getPluginState);
    codapInterface.on("notify", `dragDrop[attribute]`, "", handleDrop);
    codapInterface.on("notify", "*", "createCases", handleCasesChanged);
    codapInterface.on("notify", "*", "updateCases", handleCasesChanged);
    codapInterface.on("notify", "*", "dependentCases", handleCasesChanged);
    codapInterface.on("notify", "*", "deleteCases", handleCasesChanged);

    if (!initialized) {
      setInitialized(true);
      initializePlugin(
        PluginName,
        PluginVersion,
        InitialDimensions,
        setPluginState,
      ).then(() => registerObservers());
    }

    return () => {
      codapInterface.clear();
    };
  }, [initialized, handleDrop, handleCasesChanged, getPluginState, setPluginState]);

  return {
    dragging,
    outputToDataset,
    viewMode,
    setViewMode,
    notifyStateIsDirty,
    loadState
  };
};
