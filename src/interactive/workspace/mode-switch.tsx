import React, { useId } from "react";
import { ModeId, modeLabels } from "../authored-state";

interface ModeSwitchProps {
  mode: ModeId;
  disabled: boolean;
  onChange: (mode: ModeId, radio: HTMLInputElement) => void;
}

const modes: ModeId[] = ["useData", "draw"];

export const ModeSwitch = ({ mode, disabled, onChange }: ModeSwitchProps) => {
  const name = useId();
  return (
    <fieldset className="mode-switch">
      <legend className="visually-hidden">Mode</legend>
      { modes.map(id => (
        <label key={id}>
          <input type="radio" name={name} checked={mode === id} disabled={disabled}
            onChange={e => onChange(id, e.currentTarget)} />
          { modeLabels[id] }
        </label>
      )) }
    </fieldset>
  );
};
