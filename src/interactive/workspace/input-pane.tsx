import React from "react";
import { InputView } from "../authored-state";
import { Token } from "../input/tokenizer";
import { CommitHow, CommitView } from "./commit";
import { Highlights } from "./highlights";
import { InputTable } from "./input-table";
import { TextInput } from "./text-input";

// the share of the linked view's height the text box takes, above the table
const inputSplit = 0.4;

interface InputPaneProps {
  view: InputView;
  text: string;
  // the text's tokens as it stands, and the highlights over them, for the text box
  liveTokens: Token[];
  liveHighlights: Highlights;
  committed: { text: string, tokens: Token[] };
  // the highlights over the committed tokens, for the table
  highlights: Highlights;
  readOnly: boolean;
  onChange: (text: string) => void;
  onTextCommit: (text: string, how: CommitHow, view: CommitView) => void;
  onTextBlur: () => void;
  onTableCommit: (text: string) => void;
  onRowBlur: (commitRow: () => void) => void;
  afterPress: (run: () => void) => void;
  onRowAdded: () => void;
  onRowDeleted: () => void;
  onFocusToken: (token: Token | undefined) => void;
}

// The student's input: the text box, the table of its tokens, or both, linked through the text
export const InputPane = (props: InputPaneProps) => {
  const { view, text, liveTokens, liveHighlights, committed, readOnly, onChange, onTextCommit } = props;
  const textInput = view !== "table" &&
    <TextInput text={text} tokens={liveTokens} highlights={liveHighlights} readOnly={readOnly} onChange={onChange}
      onCommit={(next, how) => onTextCommit(next, how, "text")} onBlur={props.onTextBlur} />;
  const table = view !== "text" &&
    <InputTable text={committed.text} tokens={committed.tokens} highlights={props.highlights} readOnly={readOnly}
      onCommit={props.onTableCommit} onRowAdded={props.onRowAdded}
      onRowDeleted={props.onRowDeleted} onRowBlur={props.onRowBlur}
      afterPress={props.afterPress} onFocusToken={props.onFocusToken} />;
  return (
    <div className={`input-pane-content ${view}`}>
      { view === "textAndTable"
        ? <>
            <div className="input-text-part" style={{ flexBasis: `${inputSplit * 100}%` }}>{ textInput }</div>
            <div className="input-table-part">{ table }</div>
          </>
        : textInput || table
      }
    </div>
  );
};
