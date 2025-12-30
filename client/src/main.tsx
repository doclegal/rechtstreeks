import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAuthStore } from "./lib/authStore";

initAuthStore();

createRoot(document.getElementById("root")!).render(<App />);
