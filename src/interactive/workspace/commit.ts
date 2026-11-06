// where an input commit was made, and what made it, as InputCommitted logs them
export type CommitView = "text" | "table";
export type CommitHow = "separator" | "insert" | "remove" | "pause" | "blur" | "row";
