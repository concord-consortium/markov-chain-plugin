// The initInteractive message LARA, the Activity Player and portal-report send to start the interactive in a mode.
export type HostedMode = "authoring" | "runtime" | "report";

export const initInteractiveMessage = (mode: HostedMode, authoredState: unknown, interactiveState: unknown) => ({
  version: 1,
  mode,
  authoredState: authoredState ?? null,
  interactiveState: interactiveState ?? null,
  hostFeatures: {},
});
