import { useEffect, useRef } from "react";
import { setHeight } from "@concord-consortium/lara-interactive-api";

// Reports the height of the element the returned ref is on, whenever it changes, so the host sizes its frame to
// it; LARA's and the Activity Player's frames don't scroll. The library's useAutoSetHeight also measures the
// frame itself, so a frame it has grown never shrinks again.
export const useFrameHeight = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => setHeight(Math.ceil(element.getBoundingClientRect().height)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return ref;
};
