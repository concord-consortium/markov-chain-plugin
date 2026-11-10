import React, { useCallback, useRef } from "react";
import { MarkovToolApi } from "../../hooks/use-markov-tool";

interface ControlsRowProps {
  tool: MarkovToolApi;
  children: React.ReactNode;
  // at the row's right end, after Clear highlight
  actions: React.ReactNode;
}

// The row above a mode's panes: its controls, Clear highlight while something is chosen, and the shell's actions
export const ControlsRow = ({ tool, children, actions }: ControlsRowProps) => {
  // focus stays in the row when the Clear highlight button goes while it has focus, so Tab carries on from there
  const rowRef = useRef<HTMLDivElement>(null);
  const clearButton = useRef<HTMLButtonElement>(null);
  const clearButtonRef = useCallback((button: HTMLButtonElement | null) => {
    const gone = clearButton.current;
    clearButton.current = button;
    if (!button && gone?.ownerDocument.activeElement === gone) {
      rowRef.current?.focus();
    }
  }, []);

  return (
    <div className="controls-row" tabIndex={-1} ref={rowRef}>
      { children }
      { tool.selection &&
        <button type="button" className="clear-highlight" disabled={tool.animating} ref={clearButtonRef}
          onClick={() => tool.clearSelection("button")}>
          Clear highlight
        </button>
      }
      { actions }
    </div>
  );
};
