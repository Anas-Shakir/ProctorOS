import { z } from "zod";

export const workspacePrefsSchema = z.object({
  fontSize: z.enum(["sm", "md", "lg"]).default("md"),
  theme: z.enum(["paper", "dark"]).default("paper"),
  navigatorSide: z.enum(["left", "right"]).default("right"),
});

export type WorkspacePrefs = z.infer<typeof workspacePrefsSchema>;

export const DEFAULT_WORKSPACE_PREFS: WorkspacePrefs = {
  fontSize: "md",
  theme: "paper",
  navigatorSide: "right",
};
