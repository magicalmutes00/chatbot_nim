import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { NeonAuthUIProvider } from "@neondatabase/auth-ui";
import "@neondatabase/auth-ui/css";
import App from "./App";
import { authClient } from "./lib/auth";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <NeonAuthUIProvider authClient={authClient}>
      <App />
    </NeonAuthUIProvider>
  </StrictMode>,
);
