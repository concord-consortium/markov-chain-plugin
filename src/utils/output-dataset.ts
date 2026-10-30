import { SendRequest } from "./codap-request";

export const OutputDatasetName = "Sequence Data";

export const guaranteeOutputDatasetAndCaseTable = async (sendRequest: SendRequest) => {
  let tFoundValue: any = null;
  // Verify dataset exists
  let tListResult: any = await sendRequest({
    "action": "get",
    "resource": "dataContextList"
  }).catch((reason) => {
    console.error("unable to get data context list because " + reason);
  });
  if (tListResult?.success) {
    tFoundValue = tListResult.values.find((iValue: any) => {
      return iValue.name === OutputDatasetName;
    });
  }
  const datasetExisted = !!tFoundValue;
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
              { "name": "State" }
            ]
          },
          {
            "name": "Sequences",
            "attrs": [
              { "name": "Sequence number" }
            ]
          }
        ]
      }
    }).catch((reason) => {
      console.error("unable to create output dataset because " + reason);
    });
    if (!(tCreateResult?.success)) {
      console.error("unable to create output dataset");
      return datasetExisted;
    }
  }
  // Verify case table exists
  tFoundValue = null;
  tListResult = await sendRequest({
    "action": "get",
    "resource": "componentList"
  }).catch((reason) => {
    console.error("unable to get component list because " + reason);
  });
  if (tListResult?.success) {
    // CODAP's componentList reply has no dataContext, so this never matches and every Play reopens the table
    tFoundValue = tListResult.values.find((iValue: any) => {
      return iValue.type === "caseTable" && iValue.dataContext === OutputDatasetName;
    });
  }
  if (!tFoundValue) {
    // Create case table
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
      console.error("unable to create case table because " + reason);
    });
    if (!(tCreateResult?.success)) {
      console.error("unable to create case table");
    }
  }
  return datasetExisted;
};

const getNextSequenceNumber = async (sendRequest: SendRequest) => {
  const result: any = await sendRequest({
    action: "get",
    resource: `dataContext[${OutputDatasetName}].itemSearch[*]`
  }).catch(() => undefined);
  if (!result?.success) {
    return 0;
  }
  // a student can type anything into the table, so only finite numbers count
  const numbers = (result.values as any[])
    .map(item => Number(item.values?.["Sequence number"]))
    .filter(n => Number.isFinite(n));
  // reduce rather than spread, which throws a RangeError on a very large table
  return numbers.length > 0 ? numbers.reduce((max, n) => Math.max(max, n)) + 1 : 0;
};

export const createSequenceOutput = (sendRequest: SendRequest) => {
  // overlapping outputs share one lookup, so each still gets its own number
  let firstSequenceNumber: Promise<number>|undefined;
  let outputCount = 0;

  return async (states: string[]) => {
    const datasetExisted = await guaranteeOutputDatasetAndCaseTable(sendRequest);
    if (firstSequenceNumber === undefined) {
      firstSequenceNumber = datasetExisted ? getNextSequenceNumber(sendRequest) : Promise.resolve(0);
    }
    const first = await firstSequenceNumber;
    const sequenceNumber = first + outputCount++;
    await sendRequest({
      action: "create",
      resource: `dataContext[${OutputDatasetName}].item`,
      values: states.map(state => ({ "Sequence number": sequenceNumber, State: state }))
    }).catch((reason) => {
      console.error("unable to create items because " + reason);
    });
  };
};
