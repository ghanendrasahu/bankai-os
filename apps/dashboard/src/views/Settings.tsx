import { useCallback, useEffect, useMemo, useState } from "react";
import type { SettingsEntries } from "@bankai/contracts";
import { api } from "../api.js";
import { PROVIDERS } from "../lib/domain.js";
import { Button, IconButton } from "../components/ui/Button.js";
import { Field, TextInput } from "../components/ui/Field.js";
import { Badge } from "../components/ui/Badge.js";
import { EmptyState, Skeleton } from "../components/ui/Loading.js";
import { Alert } from "../components/ui/Alert.js";
import { Icon } from "../components/ui/Icon.js";
import { useToast } from "../components/ui/Toasts.js";
import { useConfirm } from "../components/ui/Dialog.js";

/** Keys the runtime resolves as provider credentials (packages/agent/src/keys.ts). */
const PROVIDER_KEYS = PROVIDERS.flatMap((p) =>
  p.keySetting ? [{ key: p.keySetting, provider: p }] : []
);
const LAB_KEY = "lab.cidr";
const RESERVED = new Set([...PROVIDER_KEYS.map((k) => k.key), LAB_KEY]);

function maskValue(value: string | undefined): string {
  if (!value) return "";
  return "•".repeat(Math.min(Math.max(value.length, 8), 24));
}

export function Settings() {
  const [entries, setEntries] = useState<SettingsEntries>({});
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [worked, setWorked] = useState<string | null>(null);

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      const data = await api.get<SettingsEntries>("/settings");
      setEntries(data ?? {});
      setDrafts({});
      setBanner(null);
    } catch (e) {
      setBanner((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveKey(key: string) {
    const value = drafts[key];
    if (value === undefined) return;
    setBusyKey(key);
    try {
      const updated = await api.put<SettingsEntries>("/settings", { [key]: value });
      setEntries(updated ?? {});
      setDrafts((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      });
      toast.success(`Saved ${key}`);
      setWorked(key);
      window.setTimeout(() => setWorked((k) => (k === key ? null : k)), 1800);
    } catch (e) {
      setBanner((e as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  function clearKey(key: string) {
    confirm.ask({
      title: `Clear ${key}?`,
      body: "The value is removed from the settings store. Environment variables (if set) still apply.",
      confirmLabel: "Clear value",
      danger: true,
      onConfirm: async () => {
        try {
          await api.del(`/settings/${encodeURIComponent(key)}`);
          setEntries((s) => {
            const next = { ...s };
            delete next[key];
            return next;
          });
          setDrafts((d) => {
            const next = { ...d };
            delete next[key];
            return next;
          });
          toast.success(`Cleared ${key}`);
        } catch (e) {
          toast.error((e as Error).message);
          throw e;
        }
      },
    });
  }

  async function addCustom() {
    const key = newKey.trim();
    if (!key || !newValue.trim()) {
      setAddError("Both key and value are required.");
      return;
    }
    if (/\s/.test(key)) {
      setAddError("Keys cannot contain spaces.");
      return;
    }
    setAddError(null);
    setBusyKey("__add");
    try {
      const updated = await api.put<SettingsEntries>("/settings", { [key]: newValue.trim() });
      setEntries(updated ?? {});
      setNewKey("");
      setNewValue("");
      toast.success(`Saved ${key}`);
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  const customKeys = useMemo(
    () => Object.keys(entries).filter((k) => !RESERVED.has(k)).sort(),
    [entries]
  );

  const providerConfigured = useMemo(
    () => PROVIDER_KEYS.filter((p) => !!entries[p.key]).length,
    [entries]
  );

  if (loading) {
    return (
      <div className="page narrow">
        <Skeleton />
      </div>
    );
  }

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>
            <Icon name="settings" /> Settings
          </h1>
          <p className="page-sub">
            Key-value configuration persisted in SQLite. Secret values are masked; environment
            variables always take precedence over settings here.
          </p>
        </div>
        <IconButton icon="refresh" label="Refresh settings" onClick={() => void load()} />
      </header>

      {banner && (
        <Alert kind="error" onClose={() => setBanner(null)}>
          {banner}
        </Alert>
      )}

      {/* provider keys */}
      <section className="panel-section">
        <div className="section-head">
          <h2 style={{ margin: 0, fontSize: "var(--fs-lg)", display: "flex", gap: 8, alignItems: "center" }}>
            <Icon name="key" size={18} /> Provider API keys
          </h2>
          <Badge tone={providerConfigured > 0 ? "ok" : "warn"}>
            {providerConfigured} of {PROVIDER_KEYS.length} configured
          </Badge>
        </div>
        <div className="card">
          {PROVIDER_KEYS.map(({ key, provider }) => {
            const current = entries[key] ?? "";
            const draft = drafts[key];
            const dirty = draft !== undefined && draft !== current;
            return (
              <div className="setting-row" key={key}>
                <div className="setting-info">
                  <h4>
                    {provider.label}
                    <Badge tone={current ? "ok" : "neutral"}>{current ? "configured" : "not set"}</Badge>
                  </h4>
                  <p>{provider.hint}</p>
                </div>
                <div className="setting-control">
                  <TextInput
                    type="password"
                    autoComplete="off"
                    reveal
                    id={`key-${key}`}
                    value={draft ?? ""}
                    placeholder={current ? maskValue(current) : "paste key…"}
                    onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                    aria-label={`${provider.label} API key`}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!dirty}
                    loading={busyKey === key}
                    onClick={() => void saveKey(key)}
                  >
                    Save
                  </Button>
                  {current && (
                    <IconButton icon="trash" label={`Clear ${provider.label} key`} onClick={() => clearKey(key)} />
                  )}
                  {worked === key && <Icon name="check" size={16} />}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* lab scope */}
      <section className="settings-section">
        <div className="section-head">
          <h2 style={{ margin: 0, fontSize: "var(--fs-lg)", display: "flex", gap: 8, alignItems: "center" }}>
            <Icon name="shield" size={18} /> Security lab scope
          </h2>
          <Badge tone={entries[LAB_KEY] ? "ok" : "warn"}>{entries[LAB_KEY] ? "configured" : "not set"}</Badge>
        </div>
        <div className="card">
          <div className="setting-row" style={{ borderBottom: "none" }}>
            <div className="setting-info">
              <h4>
                {LAB_KEY}
                <span className="meta">— comma-separated CIDR ranges</span>
              </h4>
              <p>
                Scopes the port_scan and http_request tools to targets you own (loopback and *.lab
                hostnames are always allowed). Env var LAB_CIDR is honoured first.
              </p>
            </div>
            <div className="setting-control">
              <TextInput
                id="lab-cidr"
                value={drafts[LAB_KEY] ?? entries[LAB_KEY] ?? ""}
                placeholder="192.168.1.0/24"
                onChange={(e) => setDrafts((d) => ({ ...d, [LAB_KEY]: e.target.value }))}
                aria-label="Lab CIDR ranges"
              />
              <Button
                variant="primary"
                size="sm"
                disabled={drafts[LAB_KEY] === undefined}
                loading={busyKey === LAB_KEY}
                onClick={() => void saveKey(LAB_KEY)}
              >
                Save
              </Button>
              {entries[LAB_KEY] && (
                <IconButton icon="trash" label="Clear lab scope" onClick={() => clearKey(LAB_KEY)} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* custom keys */}
      <section className="settings-section">
        <h2 style={{ margin: 0, fontSize: "var(--fs-lg)", display: "flex", gap: 8, alignItems: "center" }}>
          <Icon name="wrench" size={18} /> Custom settings
        </h2>
        <p className="desc">
          Anything packages or tools read from the settings store can live here.
        </p>

        <div className="add-key-form">
          <Field label="Key" htmlFor="new-key" error={addError ?? undefined}>
            <TextInput
              id="new-key"
              value={newKey}
              placeholder="my.setting"
              onChange={(e) => setNewKey(e.target.value)}
            />
          </Field>
          <Field label="Value" htmlFor="new-value">
            <TextInput
              id="new-value"
              value={newValue}
              placeholder="value"
              onChange={(e) => setNewValue(e.target.value)}
            />
          </Field>
          <Button
            variant="tonal"
            icon="plus"
            loading={busyKey === "__add"}
            onClick={() => void addCustom()}
            disabled={!newKey.trim() || !newValue.trim()}
          >
            Add
          </Button>
        </div>

        <div className="card">
          {customKeys.length === 0 ? (
            <p className="meta" style={{ margin: 0 }}>
              No custom settings stored.
            </p>
          ) : (
            <div className="custom-keys">
              {customKeys.map((key) => (
                <div className="setting-row" key={key}>
                  <div className="setting-info">
                    <h4>
                      {key}
                      <span className="meta"> — {maskValue(entries[key] ?? "")}</span>
                    </h4>
                  </div>
                  <div className="setting-control" style={{ display: "flex", justifyContent: "flex-end" }}>
                    <IconButton icon="trash" label={`Delete ${key}`} onClick={() => clearKey(key)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {customKeys.length === 0 && !entries[LAB_KEY] && Object.keys(entries).length === 0 && (
          <EmptyState
            icon="settings"
            title="Settings are empty"
            description="Add provider keys above so your agents can reach their models."
            compact
          />
        )}
      </section>

      {confirm.element}
    </div>
  );
}
