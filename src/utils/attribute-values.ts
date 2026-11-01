import { SendRequest } from "./codap-request";

// CODAP values can be missing or non-text; an empty string breaks the chain like an empty cell
export const toStateLabel = (value: unknown) => (value === undefined || value === null) ? "" : String(value);

// resolves to undefined when the request gets no reply, so the caller can keep its current graph
export const getAttributeValues = async (sendRequest: SendRequest, datasetName: string,
                                         collectionName: string, attributeName: string) => {
  let result: any;
  try {
    result = await sendRequest({
      action: "get",
      resource: `dataContext[${datasetName}].collection[${collectionName}].caseFormulaSearch[true]`
    });
  } catch (reason) {
    console.error(`Unable to get cases in ${datasetName} because ${reason}`);
    return undefined;
  }
  if (!result?.success) {
    return [];
  }
  return (result.values as any[]).map(iCase => toStateLabel(iCase.values[attributeName]));
};
