import React, { useId } from "react";
import { clsx } from "clsx";

interface PaneProps {
  className: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  // the student pressed, focused or typed in the pane
  onInteract?: () => void;
  style?: React.CSSProperties;
  // the divider on the pane's own edge, positioned against it
  divider?: React.ReactNode;
  // false leaves out the button that collapses the pane
  collapsible?: boolean;
  children: React.ReactNode;
}

// the minus or plus on a button that collapses or reopens part of the workspace
export const ToggleIcon = ({ open }: { open: boolean }) => (
  <svg aria-hidden="true" viewBox="0 0 10 10" width="10" height="10">
    <path d={open ? "M1 5h8" : "M1 5h8M5 1v8"} stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

// A workspace pane: a header with its title and a button that collapses and reopens it. A collapsed pane keeps its
// body mounted, hidden, so what the student did in it is there when it reopens.
export const Pane = ({
  className, title, open, onToggle, onInteract, style, divider, collapsible = true, children
}: PaneProps) => {
  const bodyId = useId();
  const titleId = useId();
  const action = open ? "Collapse" : "Expand";
  return (
    <section className={clsx("pane", className, { collapsed: !open })}
      style={style} aria-labelledby={titleId}
      onPointerDownCapture={onInteract} onFocusCapture={onInteract} onKeyDownCapture={onInteract}>
      <header className="pane-header">
        <h2 id={titleId}>{ title }</h2>
        { collapsible &&
          <button type="button" className="pane-toggle" aria-expanded={open} aria-controls={bodyId}
            aria-label={`${action} ${title}`} title={`${action} ${title}`} onClick={onToggle}>
            <ToggleIcon open={open} />
          </button>
        }
      </header>
      <div id={bodyId} className="pane-body" hidden={!open}>
        { children }
      </div>
      { divider }
    </section>
  );
};
