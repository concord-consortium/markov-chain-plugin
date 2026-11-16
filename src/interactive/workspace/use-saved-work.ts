import { useCallback, useEffect, useRef, useState } from "react";
import { useLatest } from "../../hooks/use-latest";
import { MarkovInteractiveState } from "../interactive-state";

// A request to save is state, not a call, because several actions log before they set their state: the save runs once
// the render has both.
export const useSaveRequest = () => {
  const [request, setRequest] = useState(0);
  const activeRef = useRef(false);
  const requestSave = useCallback(() => setRequest(n => n + 1), []);
  const markActive = useCallback(() => {
    activeRef.current = true;
  }, []);
  return { request, activeRef, requestSave, markActive };
};

// the host's side of saving, which the workspace reaches only through this
export interface Saver {
  save: (state: MarkovInteractiveState) => void;
  // what to answer the host's page-leave request with
  setFinalState: (build?: () => MarkovInteractiveState | undefined) => void;
}

interface SavedWorkOptions {
  saver?: Saver;
  request: number;
  activeRef: React.RefObject<boolean>;
  animating: boolean;
  build: () => MarkovInteractiveState;
  // told after each save, once its state is built
  onSaved: () => void;
  // whether a save is already due for what a draw shows, which then takes the draw's positions with it
  saveDue: () => boolean;
}

// Saves the whole state when a save is requested, holding it while a sequence runs, and answers a page leave with the
// whole state once the student has done anything.
export const useSavedWork = ({ saver, request, activeRef, animating, build, onSaved, saveDue }: SavedWorkOptions) => {
  const handledRef = useRef(0);
  const awaitingDrawRef = useRef(false);
  const buildRef = useLatest(build);
  const animatingRef = useLatest(animating);
  const onSavedRef = useLatest(onSaved);
  const saveDueRef = useLatest(saveDue);

  const save = useCallback(() => {
    saver?.save(buildRef.current());
    onSavedRef.current();
  }, [saver, buildRef, onSavedRef]);

  useEffect(() => {
    if (request !== handledRef.current && !animating) {
      handledRef.current = request;
      awaitingDrawRef.current = true;
      save();
    }
  }, [save, request, animating]);

  // the drawing that follows a change holds its states' positions, and the library posts only the last state it gets
  const afterDraw = useCallback(() => {
    if (awaitingDrawRef.current && !animatingRef.current) {
      awaitingDrawRef.current = false;
      if (!saveDueRef.current()) {
        save();
      }
    }
  }, [save, animatingRef, saveDueRef]);

  useEffect(() => {
    saver?.setFinalState(() => activeRef.current ? buildRef.current() : undefined);
    return () => saver?.setFinalState(undefined);
  }, [saver, activeRef, buildRef]);

  return { afterDraw };
};
