import React, { useCallback, useRef } from "react";
import { MarkovToolApi } from "../../hooks/use-markov-tool";

// Clear highlight while something is chosen. When it goes while it has focus, focus moves to the element holding it,
// which takes focus from script only (tabIndex -1), so Tab carries on from there.
export const ClearHighlight = ({ tool }: { tool: MarkovToolApi }) => {
  const holder = useRef<HTMLElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const buttonRef = useCallback((element: HTMLButtonElement | null) => {
    const gone = button.current;
    button.current = element;
    if (element) {
      holder.current = element.parentElement;
    } else if (gone?.ownerDocument.activeElement === gone) {
      holder.current?.focus();
    }
  }, []);

  return tool.selection
    ? <button type="button" className="clear-highlight" disabled={tool.animating} ref={buttonRef}
        onClick={() => tool.clearSelection("button")}>
        Clear highlight
      </button>
    : null;
};

interface ControlsRowProps {
  tool: MarkovToolApi;
  // whether the row holds anything besides Clear highlight; without, it isn't drawn, and the panes hold Clear highlight
  filled: boolean;
  children: React.ReactNode;
  // at the row's right end, after Clear highlight
  actions: React.ReactNode;
}

// The row above a mode's panes: its controls, Clear highlight while something is chosen, and the shell's actions
export const ControlsRow = ({ tool, filled, children, actions }: ControlsRowProps) => filled
  ? (
    <div className="controls-row" tabIndex={-1}>
      { children }
      <ClearHighlight tool={tool} />
      { actions }
    </div>
  )
  : null;
