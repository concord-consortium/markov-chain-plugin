import { useState, useEffect } from "react";

export const useResizeObserver = (ref: React.MutableRefObject<HTMLElement | null>) => {
  const [dimensions, setDimensions] = useState<DOMRectReadOnly|null>(null);

  useEffect(() => {
    const observeTarget = ref.current;

    if (observeTarget) {
      const resizeObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          setDimensions(entry.contentRect);
        });
      });
      resizeObserver.observe(observeTarget);

      return () => {
        resizeObserver.unobserve(observeTarget);
      };
    }
  }, [ref]);

  return dimensions;
};
