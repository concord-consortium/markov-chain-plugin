import React, { forwardRef, useImperativeHandle } from "react";
import { clsx } from "clsx";

import { useMarkovTool } from "../hooks/use-markov-tool";
import { Drawing } from "./drawing";
import { Dataset } from "./dataset";
import { Generator } from "./generator";
import { SequenceOutput } from "./sequence-output";
import { ConfirmModal } from "./confirm-modal";
import { MarkovHost, MarkovToolHandle } from "./host";

import "./app.scss";

interface MarkovToolProps {
  host: MarkovHost;
  // the tool shows "Loading ..." until the host has its saved state
  loadState: "loading" | "loaded";
  // something is being dragged over the tool, which dataset mode shows
  dragging: boolean;
}

export const MarkovTool = forwardRef<MarkovToolHandle, MarkovToolProps>(({ host, loadState, dragging }, ref) => {
  const { viewMode } = host;
  const { handle, graph, graphEmpty, animating, graphHighlights, setSelectedNodeId, generatorProps, outputProps, view }
    = useMarkovTool(host);
  useImperativeHandle(ref, () => handle, [handle]);

  if (loadState === "loading") {
    return <div className="loading">Loading ...</div>;
  }

  if (!viewMode) {
    return (
      <div className={clsx("app")}>
        <div className="instructions">
          <h2>Select Mode</h2>
          <div className="select-view-mode">
            <div>
              <button onClick={view.onSelectDatasetMode}>Dataset</button>
              <div>
                Use existing data to generate a Markov Chain.
              </div>
            </div>
            <div>
              <button onClick={view.onSelectDrawingMode}>Drawing</button>
              <div>
                Create a Markov Chain by dragging and dropping elements.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const maybeRenderRightBar = () => {
    if (viewMode === "dataset" && graphEmpty) {
      return;
    }

    return (
      <div className="right">
        <Generator {...generatorProps} />
        <SequenceOutput {...outputProps} />
      </div>
    );
  };

  return (
    <div className={clsx("app", { dragging })}>
      <div className="split">
        <div className="left">
          { viewMode === "drawing"
            ?
              <Drawing
                graph={graph}
                {...graphHighlights}
                animating={animating}
                graphOpacity={view.graphOpacity}
                setGraph={view.setGraph}
                setHighlightNode={view.setHighlightNode}
                setSelectedNodeId={setSelectedNodeId}
                onReset={view.onReset}
                onReturnToMainMenu={view.onReturnToMainMenu}
                onFitView={view.onFitView}
                onRecenterView={view.onRecenterView}
                fitViewAt={view.fitViewAt}
                recenterViewAt={view.recenterViewAt}
                resetViewAt={view.resetViewAt}
                onDimensions={view.onDimensions}
                onClearHighlightOutput={view.onClearHighlightOutput}
              />
            :
              <Dataset
                graph={graph}
                {...graphHighlights}
                animating={animating}
                graphEmpty={graphEmpty}
                graphOpacity={view.graphOpacity}
                setSelectedNodeId={setSelectedNodeId}
                onReset={view.onReset}
                onReturnToMainMenu={view.onReturnToMainMenu}
                onFitView={view.onFitView}
                onRecenterView={view.onRecenterView}
                fitViewAt={view.fitViewAt}
                recenterViewAt={view.recenterViewAt}
                onDimensions={view.onDimensions}
              />
          }
        </div>
        { maybeRenderRightBar() }
        { view.confirmModal && <ConfirmModal {...view.confirmModal} /> }
      </div>
    </div>
  );
});
MarkovTool.displayName = "MarkovTool";
