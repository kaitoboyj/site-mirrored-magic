import { Buffer } from 'buffer';
// Polyfill Buffer for browsers in production builds (Solana/web3.js)
;(window as any).Buffer = (window as any).Buffer || Buffer;

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
