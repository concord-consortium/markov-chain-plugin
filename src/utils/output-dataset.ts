import { SendRequest } from "./codap-request";

export const OutputDatasetName = "Sequence Data";

export const guaranteeOutputDatasetAndCaseTable = async (sendRequest: SendRequest) => {
  let tFoundValue: any = null;
  // Verify dataset exists
  let tListResult: any = await sendRequest({
    "action": "get",
    "resource": "dataContextList"
  }).catch((reason) => {
    console.log("unable to get data context list because " + reason);
  });
  if (tListResult?.success) {
    tFoundValue = tListResult.values.find((iValue: any) => {
      return iValue.name === OutputDatasetName;
    });
  }
  if (!tFoundValue) {
    // Create output dataset
    const tCreateResult: any = await sendRequest({
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
  tFoundValue = null;
  tListResult = await sendRequest({
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
    const tCreateResult: any = await sendRequest({
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
};
