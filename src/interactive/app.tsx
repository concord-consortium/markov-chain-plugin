import React, { useEffect } from "react";
import { inIframe, setSupportedFeatures, useInitMessage } from "@concord-consortium/lara-interactive-api";
import { readAuthoredState } from "./authored-state";
import { Authoring } from "./authoring";
import { MarkovInteractiveState } from "./interactive-state";
import { Runtime } from "./runtime";
import { authoredStateFromSearch } from "./url-settings";
import { useFrameHeight } from "./use-frame-height";

import "./interactive.scss";

// Started by LARA or the Activity Player, which send the init message and keep the states.
const HostedApp = () => {
  const initMessage = useInitMessage<MarkovInteractiveState, unknown>();
  const ref = useFrameHeight();

  useEffect(() => {
    // LARA shows the authoring form only for an interactive that says it supports authored state
    setSupportedFeatures({ authoredState: true, interactiveState: true });
  }, []);

  const renderMode = () => {
    if (!initMessage) {
      return <div className="loading">Loading...</div>;
    }
    switch (initMessage.mode) {
      case "authoring":
        return <Authoring initialState={readAuthoredState(initMessage.authoredState)} />;
      case "runtime":
        return (
          <Runtime authoredState={readAuthoredState(initMessage.authoredState)}
            interactiveState={initMessage.interactiveState} />
        );
      default:
        return (
          <div className="unsupported-mode">
            The Markov interactive doesn&apos;t support { initMessage.mode } mode yet.
          </div>
        );
    }
  };

  return <div className="markov-interactive" ref={ref}>{ renderMode() }</div>;
};

// Opened directly, as a link from a collection page opens it: no host will send an init message or keep a state,
// so it takes its settings from its link and leaves the library alone, whose client would only warn and hold messages.
const StandaloneApp = () => (
  <div className="markov-interactive">
    <Runtime authoredState={authoredStateFromSearch(window.location.search)} standalone={true} />
  </div>
);

export const App = () => inIframe() ? <HostedApp /> : <StandaloneApp />;
