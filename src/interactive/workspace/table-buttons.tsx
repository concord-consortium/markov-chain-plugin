import React, { useId } from "react";

export type TablesAction = "send" | "download";

export const tablesActionLabels: Record<TablesAction, string> = {
  send: "Send to CODAP", download: "Download tables",
};

interface TableButtonProps {
  action: TablesAction;
  offReason?: string;
  onPress: (action: TablesAction) => void;
}

// aria-disabled, so the button stays in the Tab order and its reason can be reached
const TableButton = ({ action, offReason, onPress }: TableButtonProps) => {
  const reasonId = useId();
  return (
    <>
      <button type="button" title={offReason} aria-disabled={!!offReason}
        aria-describedby={offReason ? reasonId : undefined} onClick={() => !offReason && onPress(action)}>
        { tablesActionLabels[action] }
      </button>
      { offReason && <span className="visually-hidden" id={reasonId}>{ offReason }</span> }
    </>
  );
};

interface TableButtonsProps {
  actions: TablesAction[];
  offReason?: string;
  onPress: (action: TablesAction) => void;
}

export const TableButtons = ({ actions, offReason, onPress }: TableButtonsProps) => (
  <div className="table-buttons">
    { actions.map(action => <TableButton key={action} action={action} offReason={offReason} onPress={onPress} />) }
  </div>
);
