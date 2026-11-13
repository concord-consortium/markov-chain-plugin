import { act, renderHook } from "@testing-library/react";
import { textSavePause, useTextSave } from "./use-text-save";

const start = () => {
  const requestSave = jest.fn();
  const committedRef = { current: "saved" };
  const savedRef = { current: "saved" };
  const { result, rerender, unmount } = renderHook(() => useTextSave({ requestSave, committedRef, savedRef }));
  const change = () => {
    committedRef.current = "changed";
  };
  return { requestSave, committedRef, savedRef, change, result, rerender, unmount };
};

describe("useTextSave", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("saves a commit once the typing has paused for the whole pause, and not before", () => {
    const { requestSave, change, result } = start();
    act(() => {
      result.current.typed();
      change();
      result.current.committed();
      jest.advanceTimersByTime(textSavePause - 1);
    });
    expect(requestSave).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(requestSave).toHaveBeenCalledTimes(1);
  });

  it("starts the pause again at each keystroke", () => {
    const { requestSave, change, result } = start();
    act(() => {
      change();
      result.current.typed();
      jest.advanceTimersByTime(textSavePause - 1);
      result.current.typed();
      jest.advanceTimersByTime(textSavePause - 1);
    });
    expect(requestSave).not.toHaveBeenCalled();
  });

  it("measures the pause from the typing when a commit comes later, as a deletion's does", () => {
    const { requestSave, change, result } = start();
    act(() => {
      result.current.typed();
      jest.advanceTimersByTime(1000);
      change();
      result.current.committed();
      jest.advanceTimersByTime(textSavePause - 1000);
    });
    expect(requestSave).toHaveBeenCalledTimes(1);
  });

  it("starts the pause at a commit with no typing, as a deleted row's", () => {
    const { requestSave, change, result } = start();
    act(() => {
      change();
      result.current.committed();
      jest.advanceTimersByTime(textSavePause);
    });
    expect(requestSave).toHaveBeenCalledTimes(1);
  });

  it("saves at once when asked, and doesn't save again at the pause", () => {
    const { requestSave, savedRef, committedRef, change, result } = start();
    act(() => {
      result.current.typed();
      change();
      result.current.saveNow();
    });
    expect(requestSave).toHaveBeenCalledTimes(1);
    savedRef.current = committedRef.current;
    committedRef.current = "changed again, with the pause canceled";
    act(() => {
      jest.advanceTimersByTime(textSavePause);
    });
    expect(requestSave).toHaveBeenCalledTimes(1);
  });

  it("asks for no save when another save took the text during the pause", () => {
    const { requestSave, savedRef, committedRef, change, result } = start();
    act(() => {
      change();
      result.current.committed();
      savedRef.current = committedRef.current;
      jest.advanceTimersByTime(textSavePause);
    });
    expect(requestSave).not.toHaveBeenCalled();
  });

  it("asks for no save with the text unchanged", () => {
    const { requestSave, result } = start();
    act(() => {
      result.current.saveNow();
      result.current.typed();
      jest.advanceTimersByTime(textSavePause);
    });
    expect(requestSave).not.toHaveBeenCalled();
  });

  it("drops the pause on unmount", () => {
    const { requestSave, change, result, unmount } = start();
    act(() => {
      change();
      result.current.typed();
    });
    unmount();
    jest.advanceTimersByTime(textSavePause);
    expect(requestSave).not.toHaveBeenCalled();
  });

  it("keeps its identity across renders, which the input table's memo needs", () => {
    const { result, rerender } = start();
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
