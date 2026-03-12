import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { TimezoneProvider } from "./contexts/TimezoneContext";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename="/dashboard">
      <TimezoneProvider>
        <App />
      </TimezoneProvider>
    </BrowserRouter>
  </StrictMode>,
);
