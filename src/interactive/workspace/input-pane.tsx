import React from "react";
import { maxInputLength } from "../interactive-state";

interface InputPaneProps {
  text: string;
  readOnly: boolean;
  onChange: (text: string) => void;
  onBlur: () => void;
}

// The student's input
export const InputPane = ({ text, readOnly, onChange, onBlur }: InputPaneProps) => (
  <div className="input-pane-content">
    <textarea className="text-input" aria-label="Your text" value={text} maxLength={maxInputLength}
      readOnly={readOnly} onChange={e => onChange(e.target.value)} onBlur={onBlur} />
  </div>
);
