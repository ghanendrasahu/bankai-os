import { useState } from "react";
import { Icon } from "./ui/Icon.js";

export interface ToolCardData {
  callId: string;
  name: string;
  args?: string;
  output?: string | null;
}

/**
 * Collapsible card describing one tool invocation — used in the chat
 * transcript (persisted tool messages and in-flight streaming events).
 */
export function ToolCard({ call }: { call: ToolCardData }) {
  const [open, setOpen] = useState(call.output == null);

  let argsPretty = call.args && call.args.trim() ? call.args : "";
  try {
    if (call.args) argsPretty = JSON.stringify(JSON.parse(call.args), null, 2);
  } catch {
    /* keep raw args string */
  }

  return (
    <div className={`tool-card${open ? " open" : ""}`}>
      <button
        type="button"
        className="tool-card-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Icon name={call.output == null ? "spinner" : "terminal"} />
        <span>{call.name}</span>
        {call.output == null && <span className="faint">running…</span>}
        <span className="chev">
          <Icon name="chevron-right" />
        </span>
      </button>
      {open && (argsPretty || call.output) && (
        <div className="tool-card-body">
          {argsPretty && (
            <>
              <span className="tool-card-label">Arguments</span>
              <pre>{argsPretty}</pre>
            </>
          )}
          {call.output != null && (
            <>
              <span className="tool-card-label">Result</span>
              <pre>{call.output || "(empty result)"}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
