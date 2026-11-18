import React, { useEffect } from "react";
import { inIframe, setSupportedFeatures, useInitMessage } from "@concord-consortium/lara-interactive-api";
import { readAuthoredState } from "./authored-state";
import { Authoring } from "./authoring";
import { MarkovInteractiveState } from "./interactive-state";
import { PageFooter } from "./page/page-footer";
import { PageHeader } from "./page/page-header";
import { PageId } from "./page/page-links";
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
            interactiveState={initMessage.interactiveState} objectStorageConfig={initMessage.objectStorageConfig} />
        );
      case "report":
        return (
          <Runtime authoredState={readAuthoredState(initMessage.authoredState)}
            interactiveState={initMessage.interactiveState} view="report" />
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
const StandaloneApp = ({ page }: { page: PageId }) => {
  const nextText = page === "next-text-probability";
  const runtime = <Runtime authoredState={authoredStateFromSearch(window.location.search)} view="standalone" />;
  if (!nextText) {
    return <div className="markov-interactive">{ runtime }</div>;
  }
  return (
    <div className="standalone-page">
      <PageHeader />
      <main className="markov-interactive">{ runtime }</main>
      <PageFooter showLogo />
    </div>
  );
};

interface AppProps {
  page?: PageId;
}

// Hosts load interactive.html; the Next Text Probability page is never a host's, so in another site's frame it still
// shows itself rather than waiting for an init message that won't come
export const App = ({ page = "markov" }: AppProps) =>
  inIframe() && page === "markov" ? <HostedApp /> : <StandaloneApp page={page} />;
