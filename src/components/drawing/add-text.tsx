import React, { forwardRef } from "react";
import { clsx } from "clsx";

import "./add-text.scss";

interface Props {
  disabled: boolean;
  visible: boolean;
  width: number;
  onChange: (newText: string) => void
}

// eslint-disable-next-line max-len
const placeholder = "Create a Markov chain by typing or pasting text here.  WARNING: your current Markov chain will be overwritten.";

export const AddText = forwardRef<HTMLTextAreaElement, Props>(({disabled, visible, width, onChange}: Props, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.currentTarget.value.trim());
  };

  return (
    <div className={clsx("addText", {visible})} style={{width}}>
      <textarea ref={ref} placeholder={placeholder} disabled={disabled} onChange={handleChange} />
    </div>
  );
});
AddText.displayName = "AddText";
