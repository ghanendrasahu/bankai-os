import { useCallback, useEffect, useState } from "react";
import { ApiError, api, getToken, setToken } from "./api.js";
import { Chat } from "./views/Chat.js";
import { Agents } from "./views/Agents.js";
import { Runs } from "./views/Runs.js";
import { Tasks } from "./views/Tasks.js";
import { Memory } from "./views/Memory.js";
import { Settings } from "./views/Settings.js";
import { Overview } from "./views/Overview.js";
import { Icon, type IconName } from "./components/ui/Icon.js";
import { Button } from "./components/ui/Button.js";
import { TextInput } from "./components/ui/Field.js";
import { Alert } from "./components/ui/Alert.js";
import { ToastProvider } from "./components/ui/Toasts.js";
import { Spinner } from "./components/ui/Loading.js";

type Route = "overview" | "chat" | "agents" | "runs" | "tasks" | "memory" | "settings";
type Status = "checking" | "open" | "locked" | "offline";

const ROUTES: Array<{ id: Route; label: string; icon: IconName; hint: string }> = [
  { id: "overview", label: "Overview", icon: "overview", hint: "System state at a glance" },
  { id: "chat", label: "Chat", icon: "chat", hint: "Converse with an agent" },
  { id: "agents", label: "Agents", icon: "agents", hint: "Persona, model and tools" },
  { id: "tasks", label: "Tasks", icon: "tasks", hint: "Scheduled prompts" },
  { id: "runs", label: "Runs", icon: "runs", hint: "Execution history" },
  { id: "memory", label: "Memory", icon: "memory", hint: "Long-term agent memory" },
  { id: "settings", label: "Settings", icon: "settings", hint: "Keys and environment" },
];

const VALID = new Set<string>(ROUTES.map((r) => r.id));

function routeFromHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  return (VALID.has(h) ? h : "overview") as Route;
}

function navigateTo(route: Route) {
  window.location.hash = `#/${route}`;
}

/** Brand mark reused by the shell and the lock screen. */
function Brandmark({ size = 30 }: { size?: number }) {
  return (
    <span className="brand" aria-label="Bankai OS">
      <span className="brand-mark" style={{ width: size, height: size, fontSize: size * 0.42 }}>
        B
      </span>
      <span className="brand-name">Bankai OS</span>
    </span>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

function Shell() {
  const [status, setStatus] = useState<Status>("checking");
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [pendingToken, setPendingToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [drawer, setDrawer] = useState(false);

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
      // A 401 fired mid-session: after api.ts clears the token, re-probe so
      // the lock screen only appears when the server genuinely requires one.
      void probe(getToken());
    };
    window.addEventListener("bankai:logout", onLogout);
    return () => window.removeEventListener("bankai:logout", onLogout);
  }, [probe]);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    const trimmed = pendingToken.trim();
    try {
      await probe(trimmed || getToken());
      setPendingToken("");
    } finally {
      setConnecting(false);
    }
  }, [pendingToken, probe]);

  const go = useCallback((r: string) => {
    setRoute(r as Route);
    setDrawer(false);
  }, []);

  if (status === "checking") {
    return (
      <div className="login" role="status">
        <div className="login-card">
          <Brandmark size={44} />
          <p className="login-sub">
            <Spinner /> Connecting to the agent server…
          </p>
        </div>
      </div>
    );
  }

  if (status === "offline" || status === "locked") {
    return (
      <div className="login">
        <div className="login-card">
          <Brandmark size={44} />
          <h1>{status === "offline" ? "Server unreachable" : "Connect to Bankai OS"}</h1>
          <p className="login-sub">
            {status === "offline"
              ? "The agent server can't be reached. Start it with `npm run dev:server` or check the network."
              : "This server requires an API token (the BANKAI_TOKEN value set on the server)."}
          </p>
          {error && (
            <div className="login-error">
              <Alert kind="error">{error}</Alert>
            </div>
          )}
          {status === "locked" && (
            <form
              className="login-form"
              onSubmit={(e) => {
                e.preventDefault();
                void connect();
              }}
            >
              <TextInput
                type="password"
                value={pendingToken}
                onChange={(e) => setPendingToken(e.target.value)}
                placeholder="API token"
                aria-label="API token"
                autoFocus
                autoComplete="current-password"
              />
              <Button type="submit" variant="primary" loading={connecting}>
                Connect
              </Button>
            </form>
          )}
          {status === "offline" && (
            <Button variant="primary" icon="refresh" loading={connecting} onClick={() => void probe(getToken())}>
              Retry
            </Button>
          )}
        </div>
        <p className="login-foot">
          <Icon name="shield" size={13} /> Local-first · everything stays on your machine
        </p>
      </div>
    );
  }

  const nav = (
    <nav className="sidebar-nav" aria-label="Primary">
      {ROUTES.map((r) => (
        <button
          key={r.id}
          type="button"
          className="nav-item"
          aria-current={route === r.id ? "page" : undefined}
          onClick={() => {
            navigateTo(r.id);
            go(r.id);
          }}
          title={r.hint}
        >
          <Icon name={r.icon} />
          {r.label}
        </button>
      ))}
    </nav>
  );

  const sidebarBody = (
    <>
      <div className="sidebar-head">
        <button
          type="button"
          className="brand"
          onClick={() => {
            navigateTo("overview");
            go("overview");
          }}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          title="Go to overview"
        >
          <span className="brand-mark">B</span>
          <span className="brand-name">Bankai OS</span>
        </button>
      </div>
      {nav}
      <div className="sidebar-foot">
        <div className="conn">
          <span className="dot ok" aria-hidden="true" />
          Connected
        </div>
        <Button size="sm" variant="ghost" icon="lock"
          block
          onClick={() => {
            setToken(null);
            void probe(getToken());
          }}
          title="Forget the stored token and show the lock screen"
        >
          Lock
        </Button>
      </div>
    </>
  );

  return (
    <div className="app">
      {drawer && (
        <div className="drawer" onClick={() => setDrawer(false)} role="presentation">
          <aside className="sidebar" aria-label="Navigation">
            {sidebarBody}
          </aside>
        </div>
      )}

      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault(); // avoid the hash router treating #main-content as a route
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Sidebar">{sidebarBody}</aside>

      <div className="main">
        <div className="mobile-bar">
          <button type="button" className="icon-btn" aria-label="Open navigation" onClick={() => setDrawer(true)}>
            <Icon name="menu" />
          </button>
          <Brandmark />
        </div>
        <main className="view" id="main-content" tabIndex={-1} aria-label={route}>          {/* Chat must stay mounted (hidden) so SSE streams survive tab switches —
              detaching its stream would cancel the run server-side. */}
          <div className={route === "chat" ? "chat-holder" : "chat-holder hidden"}>
            <Chat />
          </div>
          {route === "overview" && <Overview onNavigate={(r) => navigateTo(r as Route)} />}
          {route === "agents" && <Agents />}
          {route === "runs" && <Runs />}
          {route === "tasks" && <Tasks />}
          {route === "memory" && <Memory />}
          {route === "settings" && <Settings />}
        </main>
      </div>
    </div>
  );
}
