import React, { useEffect, useRef } from "react";
import { maxInputLength } from "../interactive-state";
import { commitsOnTyping, textChange, Token } from "../input/tokenizer";
import { CommitHow } from "./commit";
import { Highlights } from "./highlights";

// a deletion one character at a time commits once the student stops for this long
const deletionPause = 1000;

interface TextInputProps {
  text: string;
  // the tokens of text as it stands, which the highlights index
  tokens: Token[];
  highlights: Highlights;
  readOnly: boolean;
  onChange: (text: string) => void;
  onCommit: (text: string, how: CommitHow) => void;
  onBlur: () => void;
}

// the text as runs, each highlighted token's in a mark, and a final line break so an empty last line has height
const backdropRuns = (text: string, tokens: Token[], highlights: Highlights) => {
  const runs: React.ReactNode[] = [];
  let at = 0;
  [...highlights.tokens].sort((a, b) => a - b).forEach(i => {
    const token = tokens[i];
    if (!token || token.start < at) {
      return;
    }
    runs.push(text.slice(at, token.start));
    runs.push(<mark key={i} className={`highlight-${highlights.kind}`}>{ text.slice(token.start, token.end) }</mark>);
    at = token.end;
  });
  runs.push(text.slice(at) + "\n");
  return runs;
};

// The student's text over a copy of it that draws the highlights, laid out alike so the marks sit behind the words.
// The textarea stays an ordinary text box.
export const TextInput = ({ text, tokens, highlights, readOnly, onChange, onCommit, onBlur }: TextInputProps) => {
  const backdropRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number>(undefined);

  const cancelTimer = () => {
    window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
  };
  useEffect(() => cancelTimer, []);

  // the text an input method's composition started from, while one is open
  const composedFromRef = useRef<string>(undefined);

  const commitFor = (next: string, inserted: string, removed: number) => {
    const characters = [...inserted].length;
    if (characters === 1 && commitsOnTyping(inserted)) {
      cancelTimer();
      onCommit(next, "separator");
    } else if (characters > 1) {
      cancelTimer();
      onCommit(next, "insert");
    } else if (!inserted && removed > 1) {
      cancelTimer();
      onCommit(next, "remove");
    } else if (!inserted && removed === 1) {
      cancelTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        onCommit(next, "pause");
      }, deletionPause);
    } else {
      // a word being typed waits for what ends it
      cancelTimer();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    const { inputType, data, isComposing } = e.nativeEvent as InputEvent;
    // what an input method shows while composing isn't the student's text until the composition ends
    if (isComposing || composedFromRef.current !== undefined) {
      cancelTimer();
      return;
    }
    const { inserted, removed } = textChange(text, next);
    // the text's difference can't tell a letter typed over a selection that starts with it from a deletion
    commitFor(next, inputType === "insertText" && data ? data : inserted, removed);
  };

  const handleCompositionStart = () => {
    composedFromRef.current = text;
  };
  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    const from = composedFromRef.current ?? text;
    composedFromRef.current = undefined;
    const next = e.currentTarget.value;
    const { inserted, removed } = textChange(from, next);
    commitFor(next, inserted, removed);
  };

  // the blur's commit includes any deletion waiting on its pause
  const handleBlur = () => {
    cancelTimer();
    onBlur();
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  return (
    <div className="text-input">
      <div className="backdrop" aria-hidden="true" ref={backdropRef}>
        { backdropRuns(text, tokens, highlights) }
      </div>
      <textarea aria-label="Your text" value={text} maxLength={maxInputLength} readOnly={readOnly}
        onChange={handleChange} onCompositionStart={handleCompositionStart} onCompositionEnd={handleCompositionEnd}
        onBlur={handleBlur} onScroll={handleScroll} />
    </div>
  );
};
