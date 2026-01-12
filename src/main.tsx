// src/main.tsx
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// FIX temporal para el bug de Map en framer-motion
if (typeof Map !== 'function') {
  (window as any).Map = undefined;
}

// O este otro enfoque más robusto
const OriginalMap = Map;
(window as any).Map = function (...args: any[]) {
  return new (OriginalMap as any)(...args);
};

createRoot(document.getElementById("root")!).render(<App />);