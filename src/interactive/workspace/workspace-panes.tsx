import React from "react";
import { Pane } from "./pane";
import { workspaceHeight } from "./pane-sizes";
import { usePaneLayout } from "./use-pane-layout";
import { WorkspacePaneId } from "./workspace-config";

const paneTitles: Record<WorkspacePaneId, string> = {
  input: "Input", graph: "Graph", inspect: "Inspect", generator: "Sequence Generator"
};

interface WorkspacePanesProps {
  layout: ReturnType<typeof usePaneLayout>;
  stacked: boolean;
  // the pane the student last pressed, focused or typed in
  sourcePaneRef: React.MutableRefObject<WorkspacePaneId | undefined>;
  renderPane: (id: WorkspacePaneId) => React.ReactNode;
  // a pane the student can't collapse
  fixedPane?: WorkspacePaneId;
  graphControls?: React.ReactNode;
}

// a mode's panes: Input, Graph and Inspect in a row, and the generator below them
export const WorkspacePanes = ({ layout, stacked, sourcePaneRef, renderPane, fixedPane, graphControls
}: WorkspacePanesProps) => {
  const { hasPane, open, togglePane, rowPanes, rowsDivider, rowRef, top, paneStyle, dividerFor, paneDivider } = layout;
  return (
    <>
      { rowPanes.length > 0 &&
        <div className="top-row" style={stacked ? undefined : { height: top }} ref={rowRef}>
          { rowPanes.map(({ id }) => (
            <Pane key={id} className={`${id}-pane`} title={paneTitles[id]} open={open[id]}
              onToggle={() => togglePane(id)} onInteract={() => (sourcePaneRef.current = id)} style={paneStyle(id)}
              divider={paneDivider(id)} collapsible={id !== fixedPane}
              headerControls={id === "graph" ? graphControls : undefined}>
              { renderPane(id) }
            </Pane>
          )) }
          { rowsDivider && dividerFor("rows") }
        </div>
      }
      { hasPane("generator") &&
        <Pane className="generator-pane" title={paneTitles.generator} open={open.generator}
          onToggle={() => togglePane("generator")} onInteract={() => (sourcePaneRef.current = "generator")}
          style={open.generator ? { height: workspaceHeight - top } : undefined}>
          { renderPane("generator") }
        </Pane>
      }
    </>
  );
};
