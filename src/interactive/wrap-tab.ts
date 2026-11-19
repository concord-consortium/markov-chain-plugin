import React from "react";

// A modal dialog holds focus only within its own document, so in a frame Tab would carry on into the host's page.
export const wrapTab = (e: React.KeyboardEvent, dialog: Element) => {
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>("input:enabled, button:enabled"));
  const [first, last] = [controls[0], controls[controls.length - 1]];
  const { activeElement } = dialog.ownerDocument;
  if (!first || activeElement === (e.shiftKey ? first : last) || (e.shiftKey && activeElement === dialog)) {
    e.preventDefault();
    (e.shiftKey ? last : first)?.focus();
  }
};
