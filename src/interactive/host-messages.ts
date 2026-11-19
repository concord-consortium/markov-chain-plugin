// The initInteractive message LARA, the Activity Player and portal-report send to start the interactive in a mode,
// for the demo page, the fake Activity Player page and the Next Text Probability authoring page. Their object storage
// is the library's in-memory store, unless the page asks for none, as the authoring page does.
export type HostedMode = "authoring" | "runtime" | "report";

export const initInteractiveMessage = (mode: HostedMode, authoredState: unknown, interactiveState: unknown,
  objectStorage = true) => ({
  version: 1,
  mode,
  authoredState: authoredState ?? null,
  // left out for a student with none, as the Activity Player does: a null would be saved back as a change
  interactiveState: interactiveState ?? undefined,
  hostFeatures: {},
  ...(objectStorage ? { objectStorageConfig: { version: 1, type: "demo" } } : {}),
});
