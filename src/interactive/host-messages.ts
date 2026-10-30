// The initInteractive message a host sends to start the interactive in authoring or runtime mode, as LARA and the
// Activity Player send it. The demo page and the Cypress tests' fake Activity Player page both start it this way.
export type HostedMode = "authoring" | "runtime";

export const initInteractiveMessage = (mode: HostedMode, authoredState: unknown, interactiveState: unknown) => ({
  version: 1,
  mode,
  authoredState: authoredState ?? null,
  interactiveState: interactiveState ?? null,
  hostFeatures: {},
});
