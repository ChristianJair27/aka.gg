import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// Tema "Arena": tokens y primitivas compartidas por todas las páginas.
import "./styles/tournament-dashboard.css";
import "./styles/arena.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
