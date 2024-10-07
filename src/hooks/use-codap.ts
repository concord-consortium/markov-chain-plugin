import { useCallback, useEffect, useRef, useState } from "react";
import { Edge, GraphData, Node } from "../type";
import {
  getValuesForAttribute,
  // entityInfo,
  // getNumChildAttributesInContext,
  // getValuesForAttribute,
  initializePlugin,
  registerObservers
} from "../utils/codap-helper";
import codapInterface from "../utils/codap-interface";

const PluginName = "Markov Chain";
const PluginVersion = "0.4.0";
const InitialDimensions = {
  width: 600,
  height: 420
};
const OutputDatasetName = "Sequence Data";

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

export const useCODAP = ({onCODAPDataChanged, getGraph, setGraph, setInitialGraph}: UseCODAPOptions) => {
  const [loadState, setLoadState] = useState<"loading"|"loaded">("loading");
  const [initialized, setInitialized] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [attribute, setAttribute] = useState<CODAPAttribute|undefined>(undefined);
  const [sequenceNumber, setSequenceNumber] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode|undefined>();
  const valuesRef = useRef<string[]>();

  const getPluginState = useCallback(() => {
    const state: any = {
      success: true,
      values: {
        attribute,
        viewMode,
      }
    };

    if (viewMode === "drawing") {
      const {nodes, edges} = getGraph();
      state.values.nodes = nodes;
      state.values.edges = edges;
      state.values.version = 2; // there was no version 1 but set graph returns 1 if there is no version
    }

    return state;
  }, [attribute, viewMode, getGraph]);

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
    const {datasetName, collectionName, attributeName} = codapAttribute;
    const values = await getValuesForAttribute(datasetName, collectionName, attributeName);
    const valuesChanged = !valuesRef.current || (JSON.stringify(values) !== JSON.stringify(valuesRef.current));
    const currentViewMode = viewModeOverride ?? viewMode;
    if (currentViewMode === "dataset" && valuesChanged) {
      onCODAPDataChanged(values);
      valuesRef.current = values;
    }
  }, [onCODAPDataChanged, viewMode]);

  const setPluginState = useCallback((values: any) => {
    setLoadState("loaded");

    if (values?.viewMode) {
      setViewMode(values.viewMode);

      if (values.viewMode === "drawing") {
        const {nodes, edges, version} = values;
        if (nodes !== undefined && edges !== undefined) {
          setGraph({nodes, edges}, version ?? 1);
          // save a copy of the graph
          setInitialGraph({nodes: nodes.map((n: Node) => ({...n})), edges: edges.map((e: Edge) => ({...e}))});
        }
      } else {
        if (values?.attribute) {
          setAttribute(values.attribute);
          handleDataChanged(values.attribute, values.viewMode);
        }
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

  const incrementSequenceNumber = useCallback(() => {
    setSequenceNumber(prev => prev + 1);
  }, [setSequenceNumber]);

  const guaranteeOutputDatasetAndCaseTable = useCallback(async () => {
    let tFoundValue: any = null;
    // Verify dataset exists
    let tListResult: any = await codapInterface.sendRequest({
      "action": "get",
      "resource": "dataContextList"
    }).catch((reason) => {
      console.log("unable to get data context list because " + reason);
    });
    if (tListResult?.success) {
      tFoundValue = tListResult.values.find((iValue: any) => {
        return iValue.type === "text" && iValue.name === OutputDatasetName;
      });
    }
    if (!tFoundValue) {
      // Create output dataset
      const tCreateResult: any = await codapInterface.sendRequest({
        "action": "create",
        "resource": "dataContext",
        "values": {
          "name": OutputDatasetName,
          "title": "Output Sequences",
          "collections": [
            {
              "name": "States",
              "attrs": [
                {"name": "State"}
              ]
            },
            {
              "name": "Sequences",
              "attrs": [
                {"name": "Sequence number"}
              ]
            }
          ]
        }
      }).catch((reason) => {
        console.log("unable to create output dataset because " + reason);
      });
      if (!(tCreateResult?.success)) {
        console.log("unable to create output dataset");
        return;
      }
      // setOutputDatasetID(tCreateResult.values.id);
    } else {
      // setOutputDatasetID(tFoundValue.id);
    }
    // Verify case table exists
    tListResult = await codapInterface.sendRequest({
      "action": "get",
      "resource": "componentList"
    }).catch((reason) => {
      console.log("unable to get component list because " + reason);
    });
    if (tListResult?.success) {
      tFoundValue = tListResult.values.find((iValue: any) => {
        return iValue.type === "caseTable" && iValue.dataContext === OutputDatasetName;
      });
    }
    if (!tFoundValue) {
      // Create text component
      const tCreateResult: any = await codapInterface.sendRequest({
        "action": "create",
        "resource": "component",
        values: {
          type: "caseTable",
          "name": OutputDatasetName,
          "title": "Output Sequences",
          position: "top"
        }
      }).catch((reason) => {
        console.log("unable to create case table because " + reason);
      });
      if (!(tCreateResult?.success)) {
        console.log("unable to create case table");
      }
    }
  }, []);

  const outputToDataset = useCallback(async (sequence: Node[]) => {
    await guaranteeOutputDatasetAndCaseTable();
    const requests = sequence.map((iState, iIndex) => {
      return {
        "Sequence number": sequenceNumber,
        State: iState.label
      };
    });
    await codapInterface.sendRequest({
      action: "create",
      resource: `dataContext[${OutputDatasetName}].item`,
      values: requests
    }).catch((reason) => {
      console.log("unable to create items because " + reason);
    });

    incrementSequenceNumber();
  }, [guaranteeOutputDatasetAndCaseTable, sequenceNumber, incrementSequenceNumber]);

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
