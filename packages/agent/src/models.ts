export interface ModelRef {
  provider: string;
  model: string;
}

export function parseModel(ref: string): ModelRef {
  const idx = ref.indexOf(":");
  if (idx === -1) return { provider: "groq", model: ref };
  return { provider: ref.slice(0, idx) || "groq", model: ref.slice(idx + 1) || ref };
}