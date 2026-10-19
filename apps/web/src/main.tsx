import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@st/ui/app.css";
import { App } from "./App.tsx";

createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
