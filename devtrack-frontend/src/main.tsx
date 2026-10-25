import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyTheme } from "./hooks/useTheme";
import "./index.css";

// Apply the theme before first paint to avoid a light flash in dark mode.
applyTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
