import { useCallback, useEffect, useState } from "react";
import { getToken, setToken } from "./api.js";
import { Agents } from "./components/Agents.js";
import { Chat } from "./components/Chat.js";
import { Runs } from "./components/Runs.js";

type Tab = "chat" | "agents" | "runs";

export default function App() {
  const [token, setTokenState] = useState<string | null>(getToken());
  const [tab, setTab] = useState<Tab>("chat");
  const [pendingToken, setPendingToken] = useState("");

  useEffect(() => {
    const onLogout = () => setTokenState(null);
    window.addEventListener("bankai:logout", onLogout);
    return () => window.removeEventListener("bankai:logout", onLogout);
  }, []);

  const saveToken = useCallback(() => {
    const trimmed = pendingToken.trim();
    if (!trimmed) return;
    setToken(trimmed);
    setTokenState(trimmed);
  }, [pendingToken]);

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
  }, []);

  if (!token) {
    return (
      <div className="login">
        <h1>Bankai OS</h1>
        <p>Enter your API token to connect to the agent server.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveToken();
          }}
        >
          <input
            type="password"
            value={pendingToken}
            onChange={(e) => setPendingToken(e.target.value)}
            placeholder="API token"
            autoFocus
          />
          <button type="submit">Connect</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="brand">Bankai OS</span>
        <nav className="tabs">
          {(["chat", "agents", "runs"] as Tab[]).map((t) => (
            <button
              key={t}
              className={tab === t ? "tab active" : "tab"}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        <button className="ghost" onClick={logout}>
          Disconnect
        </button>
      </header>
      <main className="app-main">
        {tab === "chat" && <Chat />}
        {tab === "agents" && <Agents />}
        {tab === "runs" && <Runs />}
      </main>
    </div>
  );
}