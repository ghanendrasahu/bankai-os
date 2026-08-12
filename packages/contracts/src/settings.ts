import { z } from "zod";

export const settingsEntriesSchema = z.record(z.string(), z.string());

export type SettingsEntries = z.infer<typeof settingsEntriesSchema>;

export const settingsSetSchema = z.record(z.string(), z.string()).refine(
  (entries) => Object.keys(entries).length > 0,
  { message: "must contain at least one key" }
);