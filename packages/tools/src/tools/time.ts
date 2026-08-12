import type { Tool } from "../types.js";

export const timeTool: Tool = {
  name: "time",
  description:
    "Get the current date and time, optionally formatted for a specific IANA timezone (e.g. 'Asia/Kolkata').",
  parameters: {
    type: "object",
    properties: {
      timezone: { type: "string", description: "IANA timezone name" },
    },
    required: [],
  },
  async execute(args) {
    const timezone = typeof args.timezone === "string" ? args.timezone : undefined;
    return timezone
      ? new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "long", timeZone: timezone }).format(new Date())
      : new Date().toISOString();
  },
};