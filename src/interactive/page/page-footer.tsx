import React, { useRef, useState } from "react";
import ConcordLogo from "../../assets/concord-logo.svg";
import { AboutDialog } from "./about-dialog";
import { ExternalLink } from "./external-link";
import { copyrightLine, termsOfUseUrl } from "./page-links";

import "./page.scss";

interface Props {
  // the Concord logo before the copyright line, which names Concord, so it's hidden from screen readers
  showLogo?: boolean;
}

// The row at the bottom of a page the interactive is opened on by itself, never inside a host's frame
export const PageFooter = ({ showLogo }: Props) => {
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <footer className="page-footer">
        { showLogo && <ConcordLogo className="page-footer-logo" aria-hidden="true" /> }
        <span>{ copyrightLine() }</span>
        <span aria-hidden="true">·</span>
        <ExternalLink href={termsOfUseUrl}>Terms of Use</ExternalLink>
        <span aria-hidden="true">·</span>
        <button type="button" className="page-footer-about" ref={aboutRef} onClick={() => setAboutOpen(true)}>
          About
        </button>
      </footer>
      { aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} returnFocusTo={aboutRef} /> }
    </>
  );
};
