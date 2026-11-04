import React from "react";
import {
  arrowMarkerPath, arrowMarkerRefX, arrowMarkerRefY, arrowMarkers, arrowMarkerSize
} from "../../components/graph-highlight";

// Every graph defines its arrowheads under the same ids, and a reference finds the first in the document, which draws
// nothing inside a hidden mode. These come first, and are never hidden.
export const ArrowMarkers = () => (
  <svg className="arrow-markers" width="0" height="0" aria-hidden="true">
    <defs>
      { arrowMarkers.map(({ id, color, opacity }) => (
        <marker key={id} id={id} refX={arrowMarkerRefX} refY={arrowMarkerRefY} markerWidth={arrowMarkerSize}
          markerHeight={arrowMarkerSize} markerUnits="strokeWidth" orient="auto">
          <path d={arrowMarkerPath} style={{ fill: color, fillOpacity: opacity ?? 1 }} />
        </marker>
      )) }
    </defs>
  </svg>
);
