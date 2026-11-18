import React from "react";
import { createRoot } from "react-dom/client";
import { Demo } from "../demo";

createRoot(document.getElementById("app") as HTMLElement).render(<Demo page="next-text-probability" />);
