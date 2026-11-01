import React from "react";
import { createRoot } from "react-dom/client";
import { CodapApp } from "./codap/codap-app";

import "./index.scss";

createRoot(document.getElementById("app") as HTMLElement).render(<CodapApp />);
