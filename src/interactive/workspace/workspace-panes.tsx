import React from "react";
import { Pane } from "./pane";
import { generatorHeight } from "./pane-sizes";
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
  // Clear highlight, in the Graph pane's header, else Inspect's, when the mode's own row isn't there to hold it
  clearHighlight?: React.ReactNode;
}

// a mode's panes: Input, Graph and Inspect in a row, and the generator below them
export const WorkspacePanes = ({ layout, stacked, sourcePaneRef, renderPane, fixedPane, graphControls, clearHighlight
}: WorkspacePanesProps) => {
  const {
    hasPane, open, togglePane, rowPanes, rowsDivider, rowRef, top, spare, paneStyle, dividerFor, paneDivider
  } = layout;
  const clearIn = (["graph", "inspect"] as const).find(id => hasPane(id) && open[id]);
  const headerControls = (id: WorkspacePaneId) => {
    const controls = id === "graph" ? graphControls : undefined;
    const clear = id === clearIn ? clearHighlight : undefined;
    return controls || clear ? <>{ controls }{ clear }</> : undefined;
  };
  return (
    <>
      { rowPanes.length > 0 &&
        <div className="top-row" style={stacked ? undefined : { height: top }} ref={rowRef}>
          { rowPanes.map(({ id }) => (
            <Pane key={id} className={`${id}-pane`} title={paneTitles[id]} open={open[id]}
              onToggle={() => togglePane(id)} onInteract={() => (sourcePaneRef.current = id)} style={paneStyle(id)}
              divider={paneDivider(id)} collapsible={id !== fixedPane}
              headerControls={headerControls(id)}>
              { renderPane(id) }
            </Pane>
          )) }
          { rowsDivider && dividerFor("rows") }
        </div>
      }
      { hasPane("generator") &&
        <Pane className="generator-pane" title={paneTitles.generator} open={open.generator}
          onToggle={() => togglePane("generator")} onInteract={() => (sourcePaneRef.current = "generator")}
          style={open.generator ? { height: generatorHeight(top, spare) } : undefined}>
          { renderPane("generator") }
        </Pane>
      }
    </>
  );
};
