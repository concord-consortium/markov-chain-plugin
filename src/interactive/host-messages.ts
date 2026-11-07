// The initInteractive message LARA, the Activity Player and portal-report send to start the interactive in a mode.
export type HostedMode = "authoring" | "runtime" | "report";

export const initInteractiveMessage = (mode: HostedMode, authoredState: unknown, interactiveState: unknown) => ({
  version: 1,
  mode,
  authoredState: authoredState ?? null,
  // left out for a student with none, as the Activity Player does: a null would be saved back as a change
  interactiveState: interactiveState ?? undefined,
  hostFeatures: {},
});
