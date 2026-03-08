import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { TimezoneProvider } from "./contexts/TimezoneContext";
import "./styles.css";

// biome-ignore lint/style/noNonNullAssertion: root element is guaranteed in index.html
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename="/dashboard">
      <TimezoneProvider>
        <App />
      </TimezoneProvider>
    </BrowserRouter>
  </StrictMode>,
);
