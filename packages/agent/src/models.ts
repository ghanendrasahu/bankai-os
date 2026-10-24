export interface ModelRef {
  provider: string;
  model: string;
}

export function parseModel(ref: string): ModelRef {
  const idx = ref.indexOf(":");
  if (idx === -1) return { provider: "opencode", model: ref };
  return { provider: ref.slice(0, idx) || "opencode", model: ref.slice(idx + 1) || ref };
}