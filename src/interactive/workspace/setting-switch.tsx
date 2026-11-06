import React, { useId } from "react";
import { clsx } from "clsx";
import { yesNo } from "../authored-state";

interface SettingSwitchProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

// The switch's name and its Yes or No are labels for it, so clicking either one flips it as the track does
export const SettingSwitch = ({ label, value, onChange, disabled }: SettingSwitchProps) => {
  const nameId = useId();
  const switchId = useId();
  return (
    <div className={clsx("setting-switch", { disabled })}>
      <label id={nameId} htmlFor={switchId} className="setting-switch-name">{ label }</label>
      <button type="button" role="switch" id={switchId} aria-checked={value} aria-labelledby={nameId}
        disabled={disabled} className="setting-switch-track" onClick={() => onChange(!value)}>
        <span className="setting-switch-thumb" />
      </button>
      <label htmlFor={switchId} className="setting-switch-value" aria-hidden="true">{ yesNo(value) }</label>
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
