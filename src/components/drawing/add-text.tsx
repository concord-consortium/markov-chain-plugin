import React, { forwardRef, useEffect, useState } from "react";
import { clsx } from "clsx";

import "./add-text.scss";

interface Props {
  disabled: boolean;
  visible: boolean;
  width: number;
  resetViewAt?: number;
  onChange: (newText: string) => void
}

// eslint-disable-next-line max-len
const placeholder = "Create a Markov chain by typing or pasting text here.  WARNING: your current Markov chain will be overwritten.";

export const AddText = forwardRef<HTMLTextAreaElement, Props>((props: Props, ref) => {
  const {disabled, visible, width, resetViewAt, onChange} = props;
  const [text, setText] = useState("");

  // listen for reset requests
  useEffect(() => {
    setText("");
  }, [resetViewAt]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.currentTarget.value;
    setText(newText);
    onChange(newText.trim());
  };

  return (
    <div className={clsx("addText", {visible})} style={{width}}>
      <textarea ref={ref} placeholder={placeholder} value={text} disabled={disabled} onChange={handleChange} />
    </div>
  );
});
AddText.displayName = "AddText";
