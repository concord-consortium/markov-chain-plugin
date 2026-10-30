// The initInteractive message a host sends to start the interactive in authoring, runtime or report mode, as LARA,
// the Activity Player and portal-report send it. The demo page and the Cypress tests' fake Activity Player page both
// start it this way.
export type HostedMode = "authoring" | "runtime" | "report";

export const initInteractiveMessage = (mode: HostedMode, authoredState: unknown, interactiveState: unknown) => ({
  version: 1,
  mode,
  authoredState: authoredState ?? null,
  interactiveState: interactiveState ?? null,
  hostFeatures: {},
});
