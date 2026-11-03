import React, { useId } from "react";
import { clsx } from "clsx";

interface PaneProps {
  className: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

// A workspace pane: a header with its title and a button that collapses and reopens it. A collapsed pane keeps its
// body mounted, hidden, so what the student did in it is there when it reopens.
export const Pane = ({ className, title, open, onToggle, style, children }: PaneProps) => {
  const bodyId = useId();
  const titleId = useId();
  const action = open ? "Collapse" : "Expand";
  return (
    <section className={clsx("pane", className, { collapsed: !open })} style={style} aria-labelledby={titleId}>
      <header className="pane-header">
        <h2 id={titleId}>{ title }</h2>
        <button type="button" className="pane-toggle" aria-expanded={open} aria-controls={bodyId}
          aria-label={`${action} ${title}`} title={`${action} ${title}`} onClick={onToggle}>
          <span aria-hidden="true">{ open ? "−" : "+" }</span>
        </button>
      </header>
      <div id={bodyId} className="pane-body" hidden={!open}>
        { children }
      </div>
    </section>
  );
};
