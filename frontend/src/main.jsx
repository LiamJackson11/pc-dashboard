import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// StrictMode removed: it double-mounts in dev which causes
// WebSocket to open, immediately close, then reopen = reconnect loop
createRoot(document.getElementById("root")).render(<App />);
