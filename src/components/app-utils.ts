import { GraphData } from "../type";
import type { ViewMode } from "../hooks/use-codap";
import { graphFromValues } from "../utils/attribute-values";

export const compareStateLabels = (a: {label: unknown}, b: {label: unknown}) =>
  String(a.label).localeCompare(String(b.label), undefined, { numeric: true });

export const graphToRestore = (viewMode: ViewMode|undefined, initialGraph: GraphData|undefined,
                               datasetValues: string[]|undefined) => {
  if (viewMode === "dataset") {
    return datasetValues ? graphFromValues(datasetValues) : undefined;
  }
  return initialGraph;
};

export const clampLengthLimit = (lengthLimit: number|undefined) =>
  lengthLimit === undefined ? undefined : Math.max(1, lengthLimit);
