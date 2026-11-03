import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CODAPAttribute, ViewMode } from "../type";
import { MarkovToolHandle } from "../components/host";
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

export const useCODAP = (tool: React.RefObject<MarkovToolHandle | null>) => {
  const [loadState, setLoadState] = useState<"loading"|"loaded">("loading");
  const [initialized, setInitialized] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [attribute, setAttribute] = useState<CODAPAttribute|undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode|undefined>();
  const valuesRef = useRef<string[] | undefined>(undefined);

  const getPluginState = useCallback(() => ({
    success: true,
    values: pluginStateValues(viewMode, attribute, () => tool.current?.getGraph() ?? { nodes: [], edges: [] })
  }), [attribute, viewMode, tool]);

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
      tool.current?.dataChanged(values);
      valuesRef.current = values;
    }
  }, [tool, viewMode]);

  const setPluginState = useCallback((values: any) => {
    setLoadState("loaded");

    const saved = readPluginState(values);
    if (saved.viewMode) {
      setViewMode(saved.viewMode);

      if (saved.drawing) {
        tool.current?.loadDrawing(saved.drawing.graph, saved.drawing.version);
      } else if (saved.attribute) {
        setAttribute(saved.attribute);
        handleDataChanged(saved.attribute, saved.viewMode);
      }
    }
  }, [setAttribute, handleDataChanged, tool]);

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

  const outputSequence = useMemo(() => createSequenceOutput(request => codapInterface.sendRequest(request)), []);

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
    viewMode,
    setViewMode,
    notifyStateIsDirty,
    loadState,
    outputSequence
  };
};
