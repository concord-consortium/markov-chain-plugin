import React, { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { MarkovHost, Selection } from "../../components/host";
import { GraphData } from "../../type";
import { ModeId } from "../authored-state";
import { SavedMode } from "../interactive-state";
import { ModeReport } from "./build-state";
import { Highlights, transitionKey } from "./highlights";
import {
  bagOfWordsExplanation, InspectTab, inspectColumns, Sort, SortColumn, sortRows, StateRow, stateRows, TransitionRow,
  transitionRows
} from "./inspect-rows";

const tabs: { id: InspectTab, label: string }[] = [
  { id: "states", label: "States" }, { id: "transitions", label: "Transitions" }
];
const columnLabels: Record<SortColumn, string> = {
  state: "State", count: "Count", transition: "Transition", probability: "Probability"
};
const startingSort: Record<InspectTab, Sort> = {
  states: { column: "state", ascending: true }, transitions: { column: "transition", ascending: true },
};

interface InspectPaneProps {
  mode: ModeId;
  // false: the Transitions tab explains the bag of words in place of its table
  orderMatters: boolean;
  graph: GraphData;
  selection: Selection;
  highlights: Highlights;
  log: MarkovHost["log"];
  onSelectState: (id: string) => void;
  onSelectTransition: (edge: { from: string, to: string }) => void;
  // the tab and sorts to open with, in place of the first tab and alphabetical order
  start?: SavedMode["inspect"];
  report?: ModeReport;
}

// The graph's states and transitions in tabs. Each table's rows are one Tab stop: Up and Down move between them, and
// Enter or Space chooses one. Its column headers' sort buttons take Tab too.
const InspectPaneContent = ({
  mode, orderMatters, graph, selection, highlights, log, onSelectState, onSelectTransition, start, report
}: InspectPaneProps) => {
  const idPrefix = useId();
  const [tab, setTab] = useState<InspectTab>(start?.tab ?? "states");
  const [sorts, setSorts] = useState({ ...startingSort, ...start?.sorts });
  useEffect(() => {
    if (report) {
      report.inspect = { tab, sorts };
    }
  }, [report, tab, sorts]);
  // the row that takes Tab in each table, by its place
  const [current, setCurrent] = useState<Record<InspectTab, number>>({ states: 0, transitions: 0 });
  const tabButtons = useRef(new Map<InspectTab, HTMLButtonElement>());
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  const chooseTab = (next: InspectTab) => {
    if (next !== tab) {
      setTab(next);
      log("InspectTabChosen", { tab: next });
    }
  };
  const handleTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") {
      return;
    }
    e.preventDefault();
    const next = tab === "states" ? "transitions" : "states";
    chooseTab(next);
    tabButtons.current.get(next)?.focus();
  };

  const sort = sorts[tab];
  const sortBy = (column: SortColumn) => {
    const ascending = sort.column !== column || !sort.ascending;
    setSorts(prev => ({ ...prev, [tab]: { column, ascending } }));
    log("InspectSorted", { tab, column, direction: ascending ? "ascending" : "descending" });
  };

  const rows = useMemo<(StateRow | TransitionRow)[]>(() => tab === "states"
    ? sortRows(stateRows(graph), sort.column, sort.ascending)
    : sortRows(transitionRows(graph), sort.column, sort.ascending), [graph, tab, sort]);
  const tabRow = Math.min(current[tab], rows.length - 1);

  const handleRowKey = (e: React.KeyboardEvent, at: number) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
      return;
    }
    e.preventDefault();
    const next = at + (e.key === "ArrowUp" ? -1 : 1);
    if (next >= 0 && next < rows.length) {
      setCurrent(prev => ({ ...prev, [tab]: next }));
      bodyRef.current?.querySelectorAll<HTMLButtonElement>("tr > td:first-child button")[next]?.focus();
    }
  };

  const columns = inspectColumns(mode);
  const tabColumns: readonly SortColumn[] = columns[tab];

  const hintId = `${idPrefix}-hint`;
  // a transition's direction from the chosen state, which its row's border shows by color
  const directionId = (direction: "in" | "out") => `${idPrefix}-${direction}`;
  const panelId = `${idPrefix}-panel`;
  const tabId = (id: InspectTab) => `${idPrefix}-${id}`;

  const renderRow = (row: StateRow | TransitionRow, at: number) => {
    const isTransition = "outOf" in row;
    const lit = isTransition ? highlights.transitions.get(transitionKey(row.from, row.to))
                             : highlights.states.has(row.id) ? highlights.kind : undefined;
    const chosen = isTransition
      ? selection?.kind === "transition" && selection.from === row.from && selection.to === row.to
      : selection?.kind === "state" && selection.id === row.id;
    const choose = () => isTransition ? onSelectTransition({ from: row.from, to: row.to }) : onSelectState(row.id);
    return (
      <tr key={isTransition ? transitionKey(row.from, row.to) : row.id}
        className={clsx(lit && `highlight-${lit}`)}
        onClick={e => {
          // a click anywhere in the row is a click on its button
          if (!(e.target as Element).closest("button")) {
            choose();
          }
        }}>
        <td>
          <button type="button" className="inspect-row-button" aria-pressed={chosen}
            aria-describedby={clsx(at === tabRow && hintId, (lit === "in" || lit === "out") && directionId(lit))
              || undefined}
            tabIndex={at === tabRow ? 0 : -1} onFocus={() => setCurrent(prev => ({ ...prev, [tab]: at }))}
            onKeyDown={e => handleRowKey(e, at)} onClick={choose}>
            { row.label }
          </button>
        </td>
        { tabColumns.includes("count") && <td>{ row.count }</td> }
        { isTransition &&
          <td>{ columns.probability === "percent" ? `${row.percent}%` : row.probability }</td>
        }
      </tr>
    );
  };

  return (
    <div className="inspect-pane-content">
      <div role="tablist" aria-label="Inspect" className="inspect-tabs">
        { tabs.map(({ id, label }) => (
          <button key={id} type="button" role="tab" id={tabId(id)} aria-selected={tab === id} aria-controls={panelId}
            tabIndex={tab === id ? 0 : -1} className={clsx("inspect-tab", { selected: tab === id })}
            ref={element => {
              if (element) {
                tabButtons.current.set(id, element);
              }
            }}
            onClick={() => chooseTab(id)} onKeyDown={handleTabKey}>
            { label }
          </button>
        )) }
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(tab)} className="inspect-panel">
        { tab === "transitions" && !orderMatters
          ? <p className="inspect-explanation">{ bagOfWordsExplanation }</p>
          : rows.length === 0
          ? <p className="inspect-empty">
              { graph.nodes.length === 0 ? "There are no states yet." : "There are no transitions yet." }
            </p>
          : <table className="inspect-table">
              <thead>
                <tr>
                  { tabColumns.map(id => {
                    const sorted = sort.column === id;
                    return (
                      <th key={id} scope="col"
                        aria-sort={sorted ? (sort.ascending ? "ascending" : "descending") : "none"}>
                        <button type="button" onClick={() => sortBy(id)}>
                          { columnLabels[id] }{ " " }
                          <span aria-hidden="true">{ sorted ? (sort.ascending ? "▲" : "▼") : "↕" }</span>
                        </button>
                      </th>
                    );
                  }) }
                </tr>
              </thead>
              <tbody ref={bodyRef}>{ rows.map(renderRow) }</tbody>
            </table>
        }
      </div>
      <p id={hintId} className="visually-hidden">Up and Down move between rows; Enter or Space chooses one.</p>
      <p id={directionId("in")} className="visually-hidden">Into the chosen state</p>
      <p id={directionId("out")} className="visually-hidden">Out of the chosen state</p>
    </div>
  );
};
// memoized so a keystroke in the text box doesn't sort and render the rows
export const InspectPane = memo(InspectPaneContent);
InspectPane.displayName = "InspectPane";
