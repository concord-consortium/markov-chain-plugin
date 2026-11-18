import React from "react";

interface Props {
  href: string;
  children: React.ReactNode;
}

// a link that opens in a new tab, and says so to a screen reader, as CODAP's ExternalLink does
export const ExternalLink = ({ href, children }: Props) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    { children }<span className="page-visually-hidden"> (opens in a new tab)</span>
  </a>
);
