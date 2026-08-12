import { useCallback, useEffect, useRef, useState } from "react";
import type { Agent, Conversation, Message, RunEvent } from "@bankai/contracts";
import { api, streamRun } from "../api.js";
import type { MessageView } from "../types.js";

function toView(m: Message): MessageView {
  return {
    role: m.role,
    content: m.content,
    toolCalls: m.toolCalls,
    createdAt: m.createdAt,
  };
}

interface StreamState {
  runId: string;
  text: string;
  toolLog: Array<{ name: string; output?: string }>;
}

export function Chat() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [stream, setStream] = useState<StreamState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      const list = await api.get<Agent[]>("/agents");
      setAgents(list);
      setAgentId((prev) => (list.some((a) => a.id === prev) ? prev : (list[0]?.id ?? "")));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    if (!agentId) {
      setConversations([]);
      setConversationId("");
      setMessages([]);
      return;
    }
    void (async () => {
      try {
        const list = await api.get<Conversation[]>(`/conversations?agentId=${encodeURIComponent(agentId)}`);
        setConversations(list);
        setConversationId((prev) => (list.some((c) => c.id === prev) ? prev : (list[0]?.id ?? "")));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [agentId]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    void (async () => {
      try {
        const list = await api.get<Message[]>(`/conversations/${conversationId}/messages`);
        setMessages(list.map(toView));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, stream]);

  async function newConversation() {
    if (!agentId) return;
    try {
      const conversation = await api.post<Conversation>("/conversations", { agentId, title: "New chat" });
      setConversations(await api.get<Conversation[]>(`/conversations?agentId=${encodeURIComponent(agentId)}`));
      setConversationId(conversation.id);
      setMessages([]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function rename(conversation: Conversation) {
    const title = prompt("Conversation title", conversation.title);
    if (!title) return;
    try {
      await api.patch(`/conversations/${conversation.id}`, { title });
      setConversations(await api.get<Conversation[]>(`/conversations?agentId=${encodeURIComponent(agentId)}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function cancelStream() {
    if (!stream) return;
    try {
      await api.post(`/runs/${stream.runId}/cancel`);
      abortRef.current?.abort();
    } catch {
      abortRef.current?.abort();
    }
  }

  async function send() {
    const prompt = input.trim();
    if (!prompt || !agentId || stream) return;

    let convId = conversationId;
    if (!convId) {
      try {
        const conversation = await api.post<Conversation>("/conversations", { agentId, title: "New chat" });
        convId = conversation.id;
        setConversationId(convId);
      } catch (e) {
        setError((e as Error).message);
        return;
      }
    }

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: prompt, createdAt: new Date().toISOString() }]);
    setStream({ runId: "", text: "", toolLog: [] });
    setError("");

    const requestId = crypto.randomUUID();
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const run = await api.post<{ id: string }>("/runs", {
        agentId,
        conversationId: convId,
        prompt,
        requestId,
      });

      setStream({ runId: run.id, text: "", toolLog: [] });

      await streamRun(run.id, (event: RunEvent) => {
        if (event.type === "delta") {
          setStream((prev) => (prev ? { ...prev, text: prev.text + event.text } : prev));
        } else if (event.type === "tool_call") {
          setStream((prev) => (prev ? { ...prev, toolLog: [...prev.toolLog, { name: event.name }] } : prev));
        } else if (event.type === "tool_result") {
          setStream((prev) =>
            prev
              ? {
                  ...prev,
                  toolLog: prev.toolLog.map((t, i) =>
                    i === prev.toolLog.length - 1 && t.name === event.name ? { ...t, output: event.output } : t
                  ),
                }
              : prev
          );
        }
      });

      const list = await api.get<Message[]>(`/conversations/${convId}/messages`);
      setMessages(list.map(toView));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStream(null);
      abortRef.current = null;
    }
  }

  const selectedConversation = conversations.find((c) => c.id === conversationId);

  return (
    <div className="chat">
      <div className="chat-sidebar">
        <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button className="primary" onClick={newConversation} disabled={!agentId}>
          New chat
        </button>
        <ul className="conv-list">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                className={c.id === conversationId ? "conv active" : "conv"}
                onClick={() => setConversationId(c.id)}
                title={c.title}
              >
                {c.title}
              </button>
              <button className="icon-btn" title="Rename" onClick={() => rename(c)}>
                ✎
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="chat-main">
        {error && <p className="error">{error}</p>}
        <div className="messages">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.role !== "user" && m.toolCalls && m.toolCalls.length > 0 && (
                <div className="tool-log">
                  {m.toolCalls.map((t, j) => (
                    <span key={j} className="badge tool">
                      {t.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="bubble">{m.content}</div>
            </div>
          ))}
          {stream && (
            <div className="msg assistant">
              {stream.toolLog.map((t, i) => (
                <div key={i} className="tool-log">
                  <span className="badge tool">{t.name}</span>
                  {t.output && <span className="muted">{t.output.slice(0, 120)}</span>}
                </div>
              ))}
              <div className="bubble">{stream.text || <span className="muted">…</span>}</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="composer">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Message…"
            disabled={!agentId}
          />
          {stream ? (
            <button className="danger" onClick={cancelStream}>
              Stop
            </button>
          ) : (
            <button className="primary" onClick={send} disabled={!agentId}>
              Send
            </button>
          )}
        </div>
        <div className="muted small">
          {selectedConversation ? selectedConversation.title : "Start a conversation to chat with the agent"}
        </div>
      </div>
    </div>
  );
}