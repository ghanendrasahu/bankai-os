import { randomUUID } from "node:crypto";

export type EntityId = string;

export function newId(prefix: string): EntityId {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}