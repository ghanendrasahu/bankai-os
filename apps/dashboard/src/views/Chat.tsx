import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Agent, Conversation, Message, RunEvent } from "@bankai/contracts";
import { api, streamRun } from "../api.js";
import { relTime, absTime, initials } from "../lib/format.js";
import { Icon } from "../components/ui/Icon.js";
import { IconButton } from "../components/ui/Button.js";
import { Select, TextInput } from "../components/ui/Field.js";
import { Alert } from "../components/ui/Alert.js";
import { Markdown } from "../components/ui/Markdown.js";
import { useToast } from "../components/ui/Toasts.js";
import { useConfirm } from "../components/ui/Dialog.js";
import { ToolCard, type ToolCardData } from "../components/ToolCard.js";
import type { MessageView } from "../types.js";

const motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function toView(m: Message): MessageView {
  return { id: m.id, role: m.role, content: m.content, toolCalls: m.toolCalls, createdAt: m.createdAt };
}

interface LiveData {
  conversationId: string;
  runId: string;
  text: string;
  tools: ToolCardData[];
  startedAt: string;
  failed: string | null;
  cancelled: boolean;
}

const MessageRow = memo(function MessageRow({
  message,
  agentName,
}: {
  message: MessageView;
  agentName: string;
}) {
  if (message.role === "user") {
    return (
      <div className="msg user" title={absTime(message.createdAt)}>
        <div className="bubble">
          {message.content.split("\n").map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (message.role === "tool") {
    const call = message.toolCalls?.[0];
    if (!call) {
      return (
        <div className="msg">
          <pre className="tl-text" style={{ maxWidth: "100%" }}>{message.content}</pre>
        </div>
      );
    }
    return (
      <div className="msg">
        <ToolCard call={{ callId: call.id, name: call.name, args: call.args, output: message.content }} />
      </div>
    );
  }

  // assistant (and anything unexpected → rendered as assistant text)
  return (
    <div className="msg" title={absTime(message.createdAt)}>
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="chips" style={{ marginBottom: 4 }}>
          {message.toolCalls.map((t) => (
            <span className="chip" key={t.id}>
              <Icon name="terminal" size={11} /> {t.name}
            </span>
          ))}
        </div>
      )}
      <div className="msg-row">
        <span className="avatar agent" aria-hidden="true">
          {initials(agentName || "AI")}
        </span>
        <div className="bubble">
          <Markdown content={message.content || "_empty response_"} />
        </div>
      </div>
    </div>
  );
});

export function Chat() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [input, setInput] = useState("");
  const [banner, setBanner] = useState<{ kind: "error" | "warn" | "ok"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState<LiveData | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [unpinned, setUnpinned] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const conversationPromises = useRef(new Map<string, Promise<Conversation>>());
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const toast = useToast();
  const confirm = useConfirm();

  /** Get-or-create the first chat for an agent (shared promise keeps StrictMode remounts from duplicating it). */
  function ensureConversation(agent: string): Promise<Conversation> {
    const pending = conversationPromises.current.get(agent);
    if (pending) return pending;
    const created = api
      .post<Conversation>("/conversations", { agentId: agent, title: "New chat" })
      .finally(() => conversationPromises.current.delete(agent));
    conversationPromises.current.set(agent, created);
    return created;
  }

  const loadAgents = useCallback(async () => {
    try {
      const list = await api.get<Agent[]>("/agents");
      setAgents(list);
      setAgentId((prev) => (list.some((a) => a.id === prev) ? prev : (list[0]?.id ?? "")));
    } catch (e) {
      setBanner({ kind: "error", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  // Component gone (Lock/navigation close) → detach any attached stream.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!agentId) {
      setConversations([]);
      setConversationId("");
      setMessages([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        let list = await api.get<Conversation[]>(`/conversations?agentId=${encodeURIComponent(agentId)}`);
        // An agent with no chats gets one automatically — straight to the composer.
        if (list.length === 0) {
          const created = await ensureConversation(agentId);
          if (cancelled) return;
          list = [created, ...list];
        }
        if (cancelled) return;
        setConversations(list);
        setConversationId((prev) => (list.some((c) => c.id === prev) ? prev : (list[0]?.id ?? "")));
      } catch (e) {
        if (!cancelled) setBanner({ kind: "error", text: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const list = await api.get<Message[]>(`/conversations/${conversationId}/messages`);
        if (!cancelled) setMessages(list.map(toView));
      } catch (e) {
        if (!cancelled) setBanner({ kind: "error", text: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  /* ---- scroll pinning ---- */

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const pinned = distance < 90;
    pinnedRef.current = pinned;
    setUnpinned(!pinned);
  }, []);

  useLayoutEffect(() => {
    if (pinnedRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: motionOK ? "smooth" : "auto", block: "end" });
    }
  }, [messages, live?.text, live?.tools.length]);

  const jumpToLatest = useCallback(() => {
    pinnedRef.current = true;
    setUnpinned(false);
    bottomRef.current?.scrollIntoView({ behavior: motionOK ? "smooth" : "auto", block: "end" });
  }, []);

  /* ---- composer auto-grow ---- */

  useLayoutEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 172)}px`;
  }, [input]);

  /* ---- conversation actions ---- */

  async function newConversation() {
    if (!agentId || live) return;
    try {
      const conversation = await api.post<Conversation>("/conversations", { agentId, title: "New chat" });
      setConversations(await api.get<Conversation[]>(`/conversations?agentId=${encodeURIComponent(agentId)}`));
      setConversationId(conversation.id);
      setMessages([]);
      setInput("");
    } catch (e) {
      setBanner({ kind: "error", text: (e as Error).message });
    }
  }

  async function submitRename() {
    if (!editing) return;
    const title = editing.value.trim();
    const target = conversations.find((c) => c.id === editing.id);
    setEditing(null);
    if (!target || !title || title === target.title) return;
    try {
      await api.patch(`/conversations/${target.id}`, { title });
      const list = await api.get<Conversation[]>(`/conversations?agentId=${encodeURIComponent(agentId)}`);
      setConversations(list);
      toast.success("Chat renamed");
    } catch (e) {
      setBanner({ kind: "error", text: (e as Error).message });
    }
  }

  async function removeConversation(conversation: Conversation) {
    if (live && live.conversationId === conversation.id) {
      // Detach (and stop) any run belonging to this chat before deleting it.
      await cancelStream(true);
    }
    confirm.ask({
      title: "Delete chat",
      body: (
        <>
          Delete <strong>{conversation.title}</strong> and its full message history? This cannot be
          undone.
        </>
      ),
      confirmLabel: "Delete chat",
      danger: true,
      onConfirm: async () => {
        try {
          await api.del(`/conversations/${conversation.id}`);
          const list = await api.get<Conversation[]>(`/conversations?agentId=${encodeURIComponent(agentId)}`);
          if (list.length === 0 && agentId) {
            const created = await ensureConversation(agentId);
            list.push(created);
          }
          setConversations(list);
          if (conversationId === conversation.id) {
            setConversationId(list[0]?.id ?? "");
            setMessages([]);
          }
          toast.success("Chat deleted");
        } catch (e) {
          setBanner({ kind: "error", text: (e as Error).message });
          throw e;
        }
      },
    });
  }

  /* ---- run lifecycle ---- */

  async function cancelStream(silent = false) {
    const current = live;
    if (!current) return;
    try {
      if (current.runId) await api.post(`/runs/${current.runId}/cancel`);
    } catch (e) {
      if (!silent) setBanner({ kind: "warn", text: (e as Error).message });
    }
    abortRef.current?.abort();
    if (!silent) setLive(null);
  }

  const send = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || !agentId || live) return;

    let convId = conversationId;
    if (!convId) {
      try {
        const conversation = await api.post<Conversation>("/conversations", { agentId, title: "New chat" });
        convId = conversation.id;
        setConversationId(convId);
      } catch (e) {
        setBanner({ kind: "error", text: (e as Error).message });
        return;
      }
    }

    setInput("");
    setBanner(null);
    setMessages((prev) => [...prev, { role: "user", content: prompt, createdAt: new Date().toISOString() }]);
    setLive({ conversationId: convId, runId: "", text: "", tools: [], startedAt: new Date().toISOString(), failed: null, cancelled: false });

    const requestId = crypto.randomUUID();
    const abort = new AbortController();
    abortRef.current = abort;
    let hadError: string | null = null;

    try {
      const run = await api.post<{ id: string }>("/runs", {
        agentId,
        conversationId: convId,
        prompt,
        requestId,
      });

      setLive((prev) => (prev ? { ...prev, runId: run.id } : prev));

      await streamRun(
        run.id,
        (event: RunEvent) => {
          switch (event.type) {
            case "delta":
              setLive((prev) => (prev ? { ...prev, text: prev.text + event.text } : prev));
              break;
            case "tool_call":
              setLive((prev) =>
                prev
                  ? {
                      ...prev,
                      tools: [...prev.tools, { callId: event.id, name: event.name, args: event.args, output: null }],
                    }
                  : prev
              );
              break;
            case "tool_result":
              setLive((prev) =>
                prev
                  ? {
                      ...prev,
                      tools: prev.tools.map((t) => (t.callId === event.id ? { ...t, output: event.output } : t)),
                    }
                  : prev
              );
              break;
            case "failed":
              hadError = event.error;
              setLive((prev) => (prev ? { ...prev, failed: event.error } : prev));
              break;
            case "cancelled":
            case "interrupted":
              setLive((prev) => (prev ? { ...prev, cancelled: true } : prev));
              break;
            default:
              break;
          }
        },
        abort.signal
      );

      // refresh the transcript with persisted assistant/tool messages —
      // do this even after a failure, because partial turns were persisted
      try {
        const list = await api.get<Message[]>(`/conversations/${convId}/messages`);
        setMessages(list.map(toView));
      } catch (e) {
        if (!abort.signal.aborted) setBanner({ kind: "error", text: (e as Error).message });
      }
      if (hadError) {
        setBanner({ kind: "error", text: hadError });
      }
    } catch (e) {
      if (!abort.signal.aborted) {
        hadError = (e as Error).message;
        setBanner({ kind: "error", text: hadError });
        setInput((prev) => prev || prompt); // restore the user's text
      }
    } finally {
      abortRef.current = null;
      setLive(null);
      if (!hadError) {
        pinnedRef.current = true;
      }
    }
  }, [agentId, conversationId, input, live]);

  const selectedConversation = conversations.find((c) => c.id === conversationId);
  const selectedAgent = agents.find((a) => a.id === agentId);
  const busy = live !== null;

  const streamStatus = useMemo(() => {
    if (!live) return "";
    const running = live.tools.find((t) => t.output == null);
    if (running) return `Running ${running.name}…`;
    if (live.text) return "Responding…";
    return "Waiting for the agent…";
  }, [live]);

  return (
    <div className="chat-root">
      <aside className="chat-rail" aria-label="Conversations">
        <div className="chat-rail-head">
          <div className="agent-pick">
            <Select
              className="compact"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              aria-label="Agent"
              disabled={busy}
            >
              {agents.length === 0 && <option value="">No agents</option>}
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <IconButton icon="plus" label="New chat" onClick={() => void newConversation()} disabled={!agentId || busy} />
          </div>
        </div>
        <nav className="chat-rail-list" aria-label="Chat history">
          {conversations.map((c) =>
            editing?.id === c.id ? (
              <div className="conv-rename" key={c.id}>
                <TextInput
                  value={editing.value}
                  autoFocus
                  aria-label="Chat title"
                  onChange={(e) => setEditing({ id: c.id, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitRename();
                    if (e.key === "Escape") setEditing(null);
                  }}
                />
                <IconButton icon="check" label="Save title" onClick={() => void submitRename()} />
              </div>
            ) : (
              <div className={`conv-item${c.id === conversationId ? " active" : ""}`} key={c.id}>
                <button type="button" className="conv-btn" onClick={() => setConversationId(c.id)} title={c.title}>
                  <span className="conv-title">{c.title}</span>
                  <span className="conv-time">{relTime(c.updatedAt)}</span>
                </button>
                <IconButton
                  icon="edit"
                  label={`Rename ${c.title}`}
                  onClick={() => setEditing({ id: c.id, value: c.title })}
                />
                <IconButton
                  icon="trash"
                  label={`Delete ${c.title}`}
                  onClick={() => void removeConversation(c)}
                />
              </div>
            )
          )}
          {conversations.length === 0 && loading && (
            <span className="skeleton line" style={{ height: 28 }} />
          )}
          {conversations.length === 0 && !loading && (
            <p className="meta" style={{ padding: "6px 10px" }}>
              No chats yet — press + to start one.
            </p>
          )}
        </nav>
      </aside>

      <section className="chat-main" aria-label="Conversation">
        {banner && (
          <div className="chat-banner">
            <Alert kind={banner.kind} onClose={() => setBanner(null)}>
              {banner.text}
            </Alert>
          </div>
        )}

        <div className="messages" ref={scrollerRef} onScroll={onScroll}>
          {messages.length === 0 && !live && (
            <div className="empty" style={{ margin: "auto" }}>
              <Icon name="chat" />
              <h3>{selectedConversation?.title ?? "Start a conversation"}</h3>
              <p>
                {selectedAgent
                  ? `Send a message to ${selectedAgent.name}. It can use its tools (time, memory, and more) when helpful.`
                  : "Create an agent first, then start chatting."}
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageRow key={m.id ?? i} message={m} agentName={selectedAgent?.name ?? ""} />
          ))}

          {live && live.conversationId === conversationId && (
            <div className="msg">
              {live.tools.map((t) => (
                <ToolCard key={t.callId} call={t} />
              ))}
              {(live.text || live.failed || live.cancelled) && (
                <div className="msg-row">
                  <span className="avatar agent" aria-hidden="true">
                    {initials(selectedAgent?.name || "AI")}
                  </span>
                  <div className="bubble streaming">
                    {live.failed ? (
                      <Alert kind="error">{live.failed}</Alert>
                    ) : live.cancelled && !live.text ? (
                      <span className="faint">Run cancelled.</span>
                    ) : (
                      <>
                        <Markdown content={live.text} />
                        <span className="caret" aria-hidden="true" />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={bottomRef} />

          {unpinned && (
            <button type="button" className="jump-btn" onClick={jumpToLatest}>
              Latest <Icon name="arrow-down" />
            </button>
          )}
        </div>

        <div className="composer">
          <form
            className="composer-box"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <textarea
              ref={composerRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={agentId ? `Message ${selectedAgent?.name ?? "agent"}…` : "Select an agent first"}
              aria-label="Message"
              disabled={!agentId}
            />
            {busy ? (
              <button
                type="button"
                className="send-btn stop"
                onClick={() => void cancelStream()}
                aria-label="Stop the running response"
                title="Stop"
              >
                <Icon name="stop" />
              </button>
            ) : (
              <button
                type="submit"
                className="send-btn"
                disabled={!input.trim() || !agentId}
                aria-label="Send message"
                title="Send"
              >
                <Icon name="send" />
              </button>
            )}
          </form>
          <div className="composer-meta">
            <span className="composer-status" aria-live="polite">
              {busy ? (
                <>
                  <span className="dot accent pulse" aria-hidden="true" />
                  {streamStatus}
                </>
              ) : (
                selectedConversation?.title && <span className="clamp-1">{selectedConversation.title}</span>
              )}
            </span>
            <span className="composer-status">
              <span className="kbd">Enter</span> send
              <span className="kbd">Shift+Enter</span> newline
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
