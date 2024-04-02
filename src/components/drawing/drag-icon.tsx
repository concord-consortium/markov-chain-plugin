import React, { useEffect, useState } from "react";
import { DrawingMode } from "../graph";
import AddNodeIcon from "../../assets/add-node-icon.svg";
import AddEdgeIcon from "../../assets/add-edge-icon.svg";
import DeleteIcon from "../../assets/delete-icon.svg";

export const DragIcon = ({ drawingMode }: { drawingMode: DrawingMode; }) => {
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const mouseHandler = (e: MouseEvent) => setStyle({ left: e.clientX - 20, top: e.clientY - 20 });
    window.addEventListener("mousemove", mouseHandler);
    return () => window.removeEventListener("mousemove", mouseHandler);
  }, []);

  if (drawingMode === "addEdge") {
    return <div className="dragIcon" style={style}><AddEdgeIcon /></div>;
  }
  if (drawingMode === "addNode") {
    return <div className="dragIcon" style={style}><AddNodeIcon /></div>;
  }
  if (drawingMode === "delete") {
    return <div className="dragIcon" style={style}><DeleteIcon /></div>;
  }
  return null;
};
