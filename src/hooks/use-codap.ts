import { useCallback, useEffect, useState } from "react";
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
const PluginVersion = "0.16";
const InitialDimensions = {
  width: 429,
  height: 420
};
const TextComponentName = "Sequences";
const OutputDatasetName = "Sequence Data";

export type CODAPAttribute = {
  datasetName: string;
  collectionName: string;
  attributeName: string;
};

export type OnCODAPDataChanged = (values: string[]) => void;

export const useCODAP = ({onCODAPDataChanged}: {onCODAPDataChanged: OnCODAPDataChanged}) => {
  const [initialized, setInitialized] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [attribute, setAttribute] = useState<CODAPAttribute|undefined>(undefined);
  const [sequenceNumber, setSequenceNumber] = useState(0);
  const [textComponentID, setTextComponentID] = useState(0);
  // const [outputDatasetID, setOutputDatasetID] = useState(0);
  const [generatedSequences, setGeneratedSequences] = useState<string[]>([]);

  const setPluginState = (values: any) => {
    // TODO: use values
  };

  const getPluginState = () => {
    return {
      success: true,
      values: {
        // no state yet...
      }
    };
  };

  const handleDataChanged = useCallback(async ({datasetName, collectionName, attributeName}: CODAPAttribute) => {
    const values = await getValuesForAttribute(datasetName, collectionName, attributeName);
    onCODAPDataChanged(values);
  }, [onCODAPDataChanged]);

  const handleDrop = useCallback(async (iMessage: any) => {
    let newAttribute: CODAPAttribute;

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
        setAttribute(newAttribute);
        await handleDataChanged(newAttribute);
        break;
    }
  }, [setDragging, setAttribute, handleDataChanged]);

  const handleCasesChanged = useCallback(async () => {
    if (attribute) {
      await handleDataChanged(attribute);
    }
  }, [attribute, handleDataChanged]);

  const incrementSequenceNumber = useCallback(() => {
    setSequenceNumber(prev => prev + 1);
  }, [setSequenceNumber]);

  const guaranteeTextComponent = useCallback(async () => {
    let tFoundValue: any = null;
    // Verify text component exists
    const tListResult: any = await codapInterface.sendRequest({
      "action": "get",
      "resource": "componentList"
    }).catch((reason) => {
      console.log("unable to get component list because " + reason);
    });
    if (tListResult?.success) {
      tFoundValue = tListResult.values.find((iValue: any) => {
        return iValue.type === "text" && iValue.name === TextComponentName;
      });
    }
    if (!tFoundValue) {
      // Create text component
      const tCreateResult: any = await codapInterface.sendRequest({
        "action": "create",
        "resource": "component",
        values: {
          type: "text",
          name: TextComponentName,
          dimensions: {width: 200, height: 400},
          position: "top"
        }
      }).catch((reason) => {
        console.log("unable to create text component because " + reason);
      });
      if (!(tCreateResult?.success)) {
        console.log("unable to create text component");
        return;
      }
      setTextComponentID(tCreateResult.values.id);
    } else {
      setTextComponentID(tFoundValue.id);
    }
  }, []);

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

  const outputTextSequence = useCallback(async (sequence: string) => {
    await guaranteeTextComponent();
    const newGeneratedSequences = [...generatedSequences, sequence];
    setGeneratedSequences(newGeneratedSequences);

    const children = newGeneratedSequences.map((iSequence) => {
      return {
        type: "paragraph",
        children: [{text: iSequence}]
      };
    });
    await codapInterface.sendRequest({
      action: "update",
      resource: `component[${textComponentID}]`,
      values: {
        text: {
          "object": "value",
          "document": {
            children,
            "objTypes": {
              "paragraph": "block"
            }
          }
        }
      }
    });

    incrementSequenceNumber();
  }, [generatedSequences, textComponentID, incrementSequenceNumber, guaranteeTextComponent]);

  const outputToDataset = useCallback(async (sequence: string[]) => {
    await guaranteeOutputDatasetAndCaseTable();
    const requests = sequence.map((iState, iIndex) => {
      return {
        "Sequence number": sequenceNumber,
        State: iState
      };
    });
    console.log(requests);
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
  }, [initialized, handleDrop, handleCasesChanged]);

  return {
    dragging,
    outputToDataset,
    outputTextSequence
  };
};
