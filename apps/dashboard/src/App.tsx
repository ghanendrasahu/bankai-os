import { useCallback, useEffect, useState } from "react";
import { ApiError, api, getToken, setToken } from "./api.js";
import { Agents } from "./components/Agents.js";
import { Chat } from "./components/Chat.js";
import { Runs } from "./components/Runs.js";

type Tab = "chat" | "agents" | "runs";
type Status = "checking" | "open" | "locked" | "offline";

export default function App() {
  const [status, setStatus] = useState<Status>("checking");
  const [tab, setTab] = useState<Tab>("chat");
  const [pendingToken, setPendingToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const probe = useCallback(async (token: string | null) => {
    // The token screen must never be a pure inconvenience: probe the server
    // first and only lock the UI when the server actually rejects requests
    // (401). Open servers go straight to the app with no token at all.
    setToken(token);
    try {
      await api.get("/agents");
      setError(null);
      setStatus("open");
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setToken(null);
        setStatus("locked");
        setError(err.message);
      } else {
        setStatus("offline");
        setError(err instanceof Error ? err.message : String(err));
      }
      return false;
    }
  }, []);

  useEffect(() => {
    void probe(getToken());
  }, [probe]);

  useEffect(() => {
    const onLogout = () => {
      // A 401 fired mid-session: after api.js clears the token, re-probe so
      // the lock screen only appears when the server genuinely requires one.
      void probe(getToken());
    };
    window.addEventListener("bankai:logout", onLogout);
    return () => window.removeEventListener("bankai:logout", onLogout);
  }, [probe]);

  const connect = useCallback(async () => {
    setError(null);
    const trimmed = pendingToken.trim();
    await probe(trimmed || getToken());
  }, [pendingToken, probe]);

  if (status === "checking") {
    return (
      <div className="login">
        <h1>Bankai OS</h1>
        <p>Connecting to the agent server…</p>
      </div>
    );
  }

  if (status === "offline" || status === "locked") {
    return (
      <div className="login">
        <h1>Bankai OS</h1>
        <p>
          {status === "offline"
            ? "Cannot reach the agent server."
            : "This server requires an API token."}
        </p>
        {error && <p className="login-error">{error}</p>}
        {status === "locked" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void connect();
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
        )}
        {status === "offline" && (
          <button type="button" onClick={() => void probe(getToken())}>
            Retry
          </button>
        )}
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
        <button className="ghost" onClick={() => void probe(getToken())}>
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
