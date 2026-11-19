import React, { useId, useLayoutEffect, useRef } from "react";
import ConcordLogo from "../../assets/concord-logo.svg";
import { wrapTab } from "../wrap-tab";
import { ExternalLink } from "./external-link";
import {
  copyrightLine, hostName, licenseUrl, licensingEmail, licensingUrl, productName, termsOfUseUrl
} from "./page-links";

interface Props {
  onClose: () => void;
  // where focus goes once the dialog has closed
  returnFocusTo: React.RefObject<HTMLElement | null>;
}

// The license and Terms of Use statement, in the wording of CODAP's About dialog
export const AboutDialog = ({ onClose, returnFocusTo }: Props) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // the browser focuses the first link, partway through the copy, and gives focus back only after Escape; the opener
  // can take focus only once close() has lifted the dialog's hold on the rest of the page
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const opener = returnFocusTo.current;
    dialog?.showModal();
    dialog?.focus();
    return () => {
      dialog?.close();
      opener?.focus();
    };
  }, [returnFocusTo]);

  const handleCancel = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onClose();
  };

  // the workspace hears Escape on the document and the window, to clear the graph's choice or leave a drawing tool
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
    if (e.key === "Tab") {
      wrapTab(e, e.currentTarget);
    }
  };

  return (
    <dialog className="about-dialog" ref={dialogRef} aria-labelledby={titleId}
      onCancel={handleCancel} onKeyDown={handleKeyDown}>
      <div className="about-dialog-title-bar">
        <h2 id={titleId}>License &amp; Terms of Use</h2>
        <button type="button" className="about-dialog-x" aria-label="Close" onClick={onClose}>
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        </button>
      </div>
      <div className="about-dialog-body">
        <ConcordLogo className="about-dialog-logo" role="img" aria-label="The Concord Consortium" />
        <p>
          <strong>{ productName } is free, open-source software.</strong> The { productName } source code is released
          under the <ExternalLink href={licenseUrl}>MIT License</ExternalLink>, so you’re welcome to use, modify, and
          build on it.
        </p>
        <p>
          <strong>Your use of { productName } at { hostName }</strong> is governed by
          our <ExternalLink href={termsOfUseUrl}>Terms of Use</ExternalLink>. The hosted version is free for
          non-commercial use; commercial use requires a separate written agreement. For more information,
          visit <ExternalLink href={licensingUrl}>concord.org/licensing</ExternalLink> or
          contact <a href={`mailto:${licensingEmail}`}>{ licensingEmail }</a>.
        </p>
        <p className="about-dialog-copyright">{ copyrightLine() }</p>
      </div>
      <div className="about-dialog-buttons">
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </dialog>
  );
};
