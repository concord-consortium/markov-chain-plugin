import { useCallback, useState } from "react";
import { zoomInStep, zoomOutStep } from "../components/graph";

// the toolbar's Zoom In and Zoom Out, as a request Graph acts on each time its id changes; onZoom hears each one
export const useZoomRequest = (onZoom?: () => void) => {
  const [zoomRequest, setZoomRequest] = useState<{ id: number, by: number }>();
  const zoom = useCallback((by: number) => {
    onZoom?.();
    setZoomRequest(request => ({ id: (request?.id ?? 0) + 1, by }));
  }, [onZoom]);
  const zoomIn = useCallback(() => zoom(zoomInStep), [zoom]);
  const zoomOut = useCallback(() => zoom(zoomOutStep), [zoom]);
  return { zoomRequest, zoomIn, zoomOut };
};
