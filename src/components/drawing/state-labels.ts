import { Node } from "../../type";

// the first "State n", counting from one past the number of states, that no state has
export const nextStateLabel = (labels: string[], from = labels.length + 1) => {
  let n = from;
  while (labels.includes(`State ${n}`)) n++;
  return `State ${n}`;
};

// why a state's new label can't be saved, if it can't
export const labelProblem = (label: string, id: string, nodes: Node[]) =>
  label.trim() === "" ? "Give the state a name."
    : nodes.some(node => node.id !== id && node.label === label.trim())
      ? `Another state is already named "${label.trim()}".` : undefined;
