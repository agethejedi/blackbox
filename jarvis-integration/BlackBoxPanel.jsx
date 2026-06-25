// BlackBoxPanel.jsx — drop into JARVIS src/components/
// Same pattern as TaniaPanel — full-screen overlay iframe

import { useState, useEffect, useRef } from "react";

const BLACKBOX_URL = "https://jarvis-blackbox.pages.dev";

export default function BlackBoxPanel({ isOpen, onClose, initialAction }) {
  const iframeRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isOpen || !loaded || !initialAction) return;
    iframeRef.current?.contentWindow?.postMessage(
      { source: "jarvis", action: initialAction.type, payload: initialAction.payload },
      BLACKBOX_URL
    );
  }, [isOpen, loaded, initialAction]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#070510" }}>
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ background: "#0a0818", borderBottom: "1px solid #1e1a2e" }}>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #2dd4bf)", color: "#070510" }}>BB</div>
          <span className="text-[11px] tracking-[0.2em] font-semibold text-white">BLACK BOX</span>
          <span className="text-[8px] tracking-[0.15em]" style={{ color: "#374151" }}>JARVIS SUBAGENT</span>
        </div>
        <button onClick={onClose}
          style={{ border: "1px solid rgba(248,113,133,0.3)", color: "rgba(248,113,133,0.7)", background: "rgba(248,113,133,0.06)", borderRadius: 4, padding: "6px 12px", fontSize: 9, letterSpacing: "0.2em", cursor: "pointer" }}>
          ✕ CLOSE
        </button>
      </div>
      <div className="flex-1 relative">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#070510" }}>
            <div className="text-center">
              <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #8b5cf6", borderTopColor: "transparent", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 9, letterSpacing: "0.2em", color: "#6b7280" }}>LOADING BLACK BOX</p>
            </div>
          </div>
        )}
        <iframe ref={iframeRef} src={BLACKBOX_URL} style={{ width: "100%", height: "100%", border: "none" }}
          onLoad={() => setLoaded(true)} title="Black Box" allow="microphone" />
      </div>
    </div>
  );
}
