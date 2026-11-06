import React, { useState } from "react";
import { MarkovHost } from "../../components/host";
import { MarkovToolApi } from "../../hooks/use-markov-tool";
import { ModeId } from "../authored-state";
import { tokenize } from "../input/tokenizer";
import { TableChoice, tableChoices, TableSource, TableWord } from "../tables/table-data";
import { ModeReport } from "./build-state";
import { TableButtons, TablesAction } from "./table-buttons";
import { TablesDialog } from "./tables-dialog";
import { WorkspaceConfig } from "./workspace-config";

interface TableActionsOptions {
  mode: ModeId;
  configs: Record<ModeId, WorkspaceConfig>;
  tools: Record<ModeId, MarkovToolApi>;
  hosts: Record<ModeId, MarkovHost>;
  orderMatters: boolean;
  reports: React.RefObject<Record<ModeId, ModeReport>>;
  tablesSaved: Record<ModeId, number>;
  onTablesSaved: (mode: ModeId) => void;
  readOnly: boolean;
}

interface OpenedDialog {
  action: TablesAction;
  source: TableSource;
  choices: TableChoice[];
}

const tablesOffReason = (tool: MarkovToolApi, mode: ModeId) => {
  if (tool.animating) {
    return "Wait for the sequence to finish.";
  }
  if (tool.graph.nodes.length > 0) {
    return undefined;
  }
  return mode === "draw" ? "Draw something first." : "Add some words first.";
};

// The row's table buttons and the popup they open. The popup blocks the workspace, so the tables it was opened with
// can't go stale.
export const useTableActions = ({
  mode, configs, tools, hosts, orderMatters, reports, tablesSaved, onTablesSaved, readOnly
}: TableActionsOptions) => {
  const [opened, setOpened] = useState<OpenedDialog>();

  const handlePress = (action: TablesAction) => {
    const { text, capitalization } = reports.current[mode];
    const { graph, outputProps } = tools[mode];
    const source: TableSource = {
      mode, graph, sequenceGroups: outputProps.sequenceGroups,
      tokens: mode === "useData" ? tokenize(text ?? "", capitalization ?? "asTyped") : [],
    };
    const hasGenerator = configs[mode].panes.some(pane => pane.id === "generator");
    setOpened({ action, source, choices: tableChoices(source, { orderMatters, hasGenerator }) });
    hosts[mode].log("TablesDialogOpened", { action });
  };

  const handleFinished = (name: string, tables: TableWord[]) => {
    hosts[mode].log("TablesDownloaded", { name, tables });
    onTablesSaved(mode);
  };

  const handleCancel = () => {
    hosts[mode].log("TablesDialogCanceled", { action: opened?.action });
    setOpened(undefined);
  };

  const shownActions: TablesAction[] = configs[mode].downloadTables && !readOnly ? ["download"] : [];
  const actions = shownActions.length > 0 &&
    <TableButtons actions={shownActions} offReason={tablesOffReason(tools[mode], mode)} onPress={handlePress} />;

  const namePrefix = mode === "draw" ? "Drawing" : "Data";
  const dialog = opened &&
    <TablesDialog {...opened} defaultName={`${namePrefix}${tablesSaved[mode] + 1}`} onFinished={handleFinished}
      onCancel={handleCancel} onClose={() => setOpened(undefined)} />;

  return { actions, dialog };
};
