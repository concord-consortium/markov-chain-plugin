import React, { useId } from "react";
import { yesNo } from "../authored-state";

interface SettingSwitchProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export const SettingSwitch = ({ label, value, onChange, disabled }: SettingSwitchProps) => {
  const nameId = useId();
  return (
    <div className="setting-switch">
      <span id={nameId} className="setting-switch-name">{ label }</span>
      <button type="button" role="switch" aria-checked={value} aria-labelledby={nameId} disabled={disabled}
        className="setting-switch-track" onClick={() => onChange(!value)}>
        <span className="setting-switch-thumb" />
      </button>
      <span className="setting-switch-value" aria-hidden="true">{ yesNo(value) }</span>
    </div>
  );
};

interface SettingLabelProps {
  label: string;
  value: boolean;
}

// a student's on or off setting as text, where the author doesn't let students change it
export const SettingLabel = ({ label, value }: SettingLabelProps) =>
  <span className="setting-label">{ `${label}: ${yesNo(value)}` }</span>;
