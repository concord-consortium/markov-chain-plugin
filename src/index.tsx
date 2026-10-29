import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/app";

import "./index.scss";

createRoot(document.getElementById("app") as HTMLElement).render(<App />);
