import React from "react";

interface ProbabilitiesToggleProps {
  on: boolean;
  onChange: (on: boolean) => void;
}

export const ProbabilitiesToggle = ({ on, onChange }: ProbabilitiesToggleProps) => (
  <button type="button" className="probabilities-toggle" aria-pressed={on} onClick={() => onChange(!on)}>
    Show probabilities
  </button>
);
