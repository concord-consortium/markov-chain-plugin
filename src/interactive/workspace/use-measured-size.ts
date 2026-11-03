import { useLayoutEffect, useState } from "react";
import { useResizeObserver } from "../../hooks/use-resize-observer";

// the element's content size from its resize observer, or its client size (padding included) at first layout until
// the observer reports, which can come a frame or more later
export const useMeasuredSize = (ref: React.MutableRefObject<HTMLElement | null>) => {
  const observed = useResizeObserver(ref);
  const [first, setFirst] = useState<{ width: number, height: number }>();
  useLayoutEffect(() => {
    const element = ref.current;
    if (element) {
      setFirst({ width: element.clientWidth, height: element.clientHeight });
    }
  }, [ref]);
  return observed ?? first;
};
