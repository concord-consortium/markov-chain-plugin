import React from "react";

interface Props {
  href: string;
  children: React.ReactNode;
}

// what a screen reader hears after a link that opens in a new tab
export const newTabNote = " (opens in a new tab)";

// a link that opens in a new tab, and says so to a screen reader, as CODAP's ExternalLink does
export const ExternalLink = ({ href, children }: Props) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    { children }<span className="page-visually-hidden">{ newTabNote }</span>
  </a>
);
