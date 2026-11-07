import React, { useId } from "react";
import { ModeId, modeIds, modeLabels } from "../authored-state";

interface ModeSwitchProps {
  mode: ModeId;
  disabled: boolean;
  onChange: (mode: ModeId, radio: HTMLInputElement) => void;
}

export const ModeSwitch = ({ mode, disabled, onChange }: ModeSwitchProps) => {
  const name = useId();
  return (
    <fieldset className="mode-switch">
      <legend className="visually-hidden">Mode</legend>
      { modeIds.map(id => (
        <label key={id}>
          <input type="radio" name={name} checked={mode === id} disabled={disabled}
            onChange={e => onChange(id, e.currentTarget)} />
          { modeLabels[id] }
        </label>
      )) }
    </fieldset>
  );
};
