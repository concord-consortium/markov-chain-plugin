// The initInteractive message LARA, the Activity Player and portal-report send to start the interactive in a mode,
// for the demo page and the fake Activity Player page. Their object storage is the library's in-memory store.
export type HostedMode = "authoring" | "runtime" | "report";

export const initInteractiveMessage = (mode: HostedMode, authoredState: unknown, interactiveState: unknown) => ({
  version: 1,
  mode,
  authoredState: authoredState ?? null,
  // left out for a student with none, as the Activity Player does: a null would be saved back as a change
  interactiveState: interactiveState ?? undefined,
  hostFeatures: {},
  objectStorageConfig: { version: 1, type: "demo" },
});
