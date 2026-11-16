import { useCallback, useEffect, useMemo, useRef } from "react";

// the input's text saves once the student has stopped typing for this long, if it hasn't left the input first
export const textSavePause = 5000;

interface TextSaveOptions {
  requestSave: () => void;
  // the committed text, and the text the last save held
  committedRef: React.RefObject<string>;
  savedRef: React.RefObject<string>;
}

// Holds the saves of a commit so a run of typing makes one step in the teacher's history rather than one a word. The
// graph still follows each commit, and any save that happens first takes the text with it.
export const useTextSave = ({ requestSave, committedRef, savedRef }: TextSaveOptions) => {
  const timerRef = useRef<number>(undefined);

  const cancel = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
  }, []);
  useEffect(() => cancel, [cancel]);

  const saveNow = useCallback(() => {
    cancel();
    if (committedRef.current !== savedRef.current) {
      requestSave();
    }
  }, [cancel, requestSave, committedRef, savedRef]);

  const typed = useCallback(() => {
    cancel();
    timerRef.current = window.setTimeout(saveNow, textSavePause);
  }, [cancel, saveNow]);

  // a commit from typing keeps the pause that typing started, and one with no typing starts it
  const committed = useCallback(() => {
    timerRef.current ??= window.setTimeout(saveNow, textSavePause);
  }, [saveNow]);

  return useMemo(() => ({ typed, committed, saveNow }), [typed, committed, saveNow]);
};
