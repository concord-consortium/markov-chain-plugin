import { useCallback, useEffect, useLayoutEffect } from "react";
import { Selection } from "../../components/host";
import { useLatest } from "../../hooks/use-latest";
import { MarkovToolApi } from "../../hooks/use-markov-tool";
import { scrollTextToMark, scrollToLit } from "./scroll-to-lit";
import { WorkspacePaneId } from "./workspace-config";

// a click in the graph focuses nothing, so Escape is heard on the whole document, which is the interactive's own;
// a hidden mode's body doesn't hear it
export const useEscape = (rootRef: React.RefObject<HTMLElement | null>, hidden: boolean,
  onEscape: (e: KeyboardEvent) => void) => {
  const hiddenRef = useLatest(hidden);
  const onEscapeRef = useLatest(onEscape);
  useEffect(() => {
    const doc = rootRef.current?.ownerDocument;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !hiddenRef.current) {
        onEscapeRef.current(e);
      }
    };
    doc?.addEventListener("keydown", handleKeyDown);
    return () => doc?.removeEventListener("keydown", handleKeyDown);
  }, [rootRef, hiddenRef, onEscapeRef]);
};

// A change that takes the chosen state or transition out of the graph clears it, logging nothing. Data mode clears an
// output itself, when the input changes; a drawing's output stays.
// It runs before the panes' effects, so a choice one makes for the same change, such as the row Up or Down reaches,
// isn't cleared with it. Nothing clears while a sequence generates, so a drawing's change then clears when it ends.
export const useClearGoneSelection = (tool: MarkovToolApi) => {
  const toolRef = useLatest(tool);
  useLayoutEffect(() => {
    const { selection, graph } = toolRef.current;
    const gone = selection?.kind === "state"
      ? !graph.nodes.some(node => node.id === selection.id)
      : selection?.kind === "transition" &&
        !graph.edges.some(edge => edge.from === selection.from && edge.to === selection.to);
    if (gone) {
      toolRef.current.setSelectedNodeId();
    }
  }, [tool.graph, tool.animating, toolRef]);
};

// Inspect's choices, which keep their identity for its memo
export const useInspectChoices = (tool: MarkovToolApi) => {
  const toolRef = useLatest(tool);
  const handleSelectState = useCallback((id: string) => toolRef.current.selectState(id, "inspect"), [toolRef]);
  const handleSelectTransition = useCallback((edge: { from: string, to: string }) =>
    toolRef.current.selectTransition(edge, "inspect"), [toolRef]);
  return { handleSelectState, handleSelectTransition };
};

// scrolls what a choice lights up into view, except in the pane it was made in
export const useScrollToChoice = (rootRef: React.RefObject<HTMLElement | null>, selection: Selection,
  sourcePaneRef: React.RefObject<WorkspacePaneId | undefined>) => {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !selection) {
      return;
    }
    const source = sourcePaneRef.current;
    const pane = (id: WorkspacePaneId) => source !== id ? root.querySelector(`.${id}-pane`) : null;
    const input = pane("input");
    if (input) {
      scrollTextToMark(input);
      scrollToLit(input, ".input-table-rows", "tr[class*='highlight-']");
    }
    const inspect = pane("inspect");
    if (inspect) {
      scrollToLit(inspect, ".inspect-panel", "tbody tr[class*='highlight-']");
    }
  }, [rootRef, sourcePaneRef, selection]);
};
