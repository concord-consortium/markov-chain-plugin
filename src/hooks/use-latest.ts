import { useLayoutEffect, useRef } from "react";

// a ref that holds the value from the last render, for a callback that must keep its identity
export const useLatest = <T, >(value: T) => {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
};
