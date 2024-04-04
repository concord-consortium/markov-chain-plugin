import { clsx } from "clsx";
import React, { useState } from "react";

import SelectIcon from "../assets/select.svg";
import AddStateIcon from "../assets/add-state.svg";
import AddTransitionIcon from "../assets/add-transition.svg";
import TextIcon from "../assets/text.svg";
import DeleteIcon from "../assets/delete.svg";
import FitViewIcon from "../assets/fit-view.svg";
import RecenterIcon from "../assets/recenter.svg";
import ResetIcon from "../assets/reset.svg";
import HomeIcon from "../assets/home.svg";

import "./toolbar.scss";

export const allTools = ["select","addNode","addEdge","addText","delete","fitView","recenter","reset","home"] as const;
const toggleableTools: Tool[] = ["select","addNode","addEdge","addText","delete"];
const nonTopTools: Tool[] = ["reset","home"];
const notImplementedTools: Tool[] = ["addText","fitView","recenter"];

export type Tool = typeof allTools[number];

const toolTitles: Record<Tool, string> = {
  select: "Select",
  addNode: "Add State",
  addEdge: "Add Transition",
  addText: "Create From Text",
  delete: "Delete",
  fitView: "Fit View",
  recenter: "Recenter View",
  reset: "Reset",
  home: "Back to Main",
};

const toolIcons: Record<Tool, any> = {
  select: SelectIcon,
  addNode: AddStateIcon,
  addEdge: AddTransitionIcon,
  addText: TextIcon,
  delete: DeleteIcon,
  fitView: FitViewIcon,
  recenter: RecenterIcon,
  reset: ResetIcon,
  home: HomeIcon,
};

interface ToolbarButtonProps {
  tool: Tool
  selectedTool: Tool;
  onClick: (tool: Tool) => void;
}

interface ToolbarProps {
  tools: Tool[]
  onToolSelected: (tool: Tool) => void;
  onReset: () => void;
  onReturnToMainMenu: () => void;
}

export const ToolbarButton = ({tool, selectedTool, onClick}: ToolbarButtonProps) => {
  const handleClick = () => onClick(tool);
  const selected = toggleableTools.includes(tool) && tool === selectedTool;
  const notImplemented = notImplementedTools.includes(tool);
  const title = `${toolTitles[tool]}${notImplemented ? " (NOT YET IMPLEMENTED)" : ""}`;
  const ToolIcon = toolIcons[tool];

  return (
    <button
      title={title}
      onClick={handleClick}
      className={clsx({selected, notImplemented})}
      disabled={notImplemented}
    >
      <ToolIcon />
    </button>
  );
};

export const Toolbar = ({tools, onToolSelected, onReset, onReturnToMainMenu}: ToolbarProps) => {
  const [selectedTool, setSelectedTool] = useState<Tool>("select");

  const handleToolSelected = (tool: Tool) => {
    if (toggleableTools.includes(tool)) {
      setSelectedTool(tool);
    } else if (tool === "reset") {
      onReset();
    } else if (tool === "home") {
      onReturnToMainMenu();
    }
    onToolSelected(tool);
  };

  const topTools = tools.filter(tool => !nonTopTools.includes(tool));
  const bottomTools = tools.filter(tool => nonTopTools.includes(tool));

  return (
    <div className="toolbar">
      <div className="top">
        {topTools.map(tool => (
          <ToolbarButton
            key={tool}
            tool={tool}
            selectedTool={selectedTool}
            onClick={handleToolSelected}
          />)
        )}
      </div>
      <div className="bottom">
        {bottomTools.map(tool => (
          <ToolbarButton
            key={tool}
            tool={tool}
            selectedTool={selectedTool}
            onClick={handleToolSelected}
          />)
        )}
      </div>
    </div>
  );
};
