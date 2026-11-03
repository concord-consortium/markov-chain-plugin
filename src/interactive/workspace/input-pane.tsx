import React, { useRef } from "react";
import { InputView } from "../authored-state";
import { Token } from "../input/tokenizer";
import { CommitHow, CommitView } from "./commit";
import { Highlights } from "./highlights";
import { Divider } from "./divider";
import { InputTable } from "./input-table";
import { dragInputSplit, minInputPart, paneGap, panePadding } from "./pane-sizes";
import { TextInput } from "./text-input";
import { useMeasuredSize } from "./use-measured-size";

interface InputPaneProps {
  view: InputView;
  // the text box's share of the height it shares with the table below it
  split: number;
  onSplitChange: (split: number) => void;
  onSplitResized: (split: number) => void;
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
        ? <LinkedInput split={props.split} onSplitChange={props.onSplitChange} onSplitResized={props.onSplitResized}
            textInput={textInput} table={table} />
        : textInput || table
      }
    </div>
  );
};

interface LinkedInputProps {
  split: number;
  onSplitChange: (split: number) => void;
  onSplitResized: (split: number) => void;
  textInput: React.ReactNode;
  table: React.ReactNode;
}

// the text box above the table, with a divider between them that sets the text box's share of the height
const LinkedInput = ({ split, onSplitChange, onSplitResized, textInput, table }: LinkedInputProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  // the height the text box and the table share, less the gap and the padding on each side of it
  const body = Math.max(0, (useMeasuredSize(ref)?.height ?? 0) - paneGap - 2 * panePadding);
  const moveFromRef = useRef(split);
  const startRef = useRef<number>(undefined);
  // the split the last move set, which a drag's end can arrive before React renders
  const movedToRef = useRef(split);
  return (
    <div className="linked-input" ref={ref}>
      <div className="input-text-part"
        style={{ flexBasis: body ? split * body + panePadding : `${split * 100}%` }}>
        { textInput }
        <Divider orientation="horizontal" label="Resize the text box and the table" value={split * body}
          min={minInputPart} max={body - minInputPart}
          onStart={() => {
            moveFromRef.current = split;
            movedToRef.current = split;
            startRef.current ??= split;
          }}
          onMove={delta => {
            if (body > 0) {
              movedToRef.current = dragInputSplit(moveFromRef.current, delta, body);
              onSplitChange(movedToRef.current);
            }
          }}
          onEnd={() => {
            if (startRef.current !== undefined && startRef.current !== movedToRef.current) {
              onSplitResized(movedToRef.current);
            }
            startRef.current = undefined;
          }} />
      </div>
      <div className="input-table-part">{ table }</div>
    </div>
  );
};
