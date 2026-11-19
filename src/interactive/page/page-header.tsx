import React from "react";
import GraphIcon from "../../assets/graph-icon.svg";
import { productName, titleSeparator } from "./page-links";

import "./page.scss";

interface Props {
  // the page's own name after the product's, such as "Authoring"
  subtitle?: string;
  // controls at the header's right
  children?: React.ReactNode;
}

// The bar at the top of a page the interactive is opened on by itself, never inside a host's frame. The divider is
// drawn; a screen reader hears the separator.
export const PageHeader = ({ subtitle, children }: Props) => (
  <header className="page-header">
    <div className="page-header-title">
      <GraphIcon className="page-header-icon" aria-hidden="true" />
      <h1>
        { productName }
        { subtitle && (
          <>
            <span className="page-visually-hidden">{ titleSeparator }</span>
            <span className="page-header-divider" aria-hidden="true" />
            <span className="page-header-subtitle">{ subtitle }</span>
          </>
        ) }
      </h1>
    </div>
    { children }
  </header>
);
