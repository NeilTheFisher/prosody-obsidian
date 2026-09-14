import type { Agent, ProsodySettings } from "./types.ts";

export const PROTOCOL_VERSION = 1;

export const CLIENT_INFO = {
  name: "prosody-obsidian",
  title: "Prosody",
  version: "0.1.0",
} as const;

export const FENCES = ["prosody", "voice-sync"] as const;

export const DEFAULT_PROMPT =
  "The attached text is a voice-note transcript. Summarize it as concise markdown: " +
  "a one-line gist, then the key points as bullets. If there are follow-ups or todos to " +
  'check off for later, add a short "Action items" section using markdown checkboxes. ' +
  "Do not invent tasks. Return only the summary.";

type AgentPreset = Pick<Agent, "id" | "displayName" | "command" | "args">;

export const AGENT_PRESETS: readonly AgentPreset[] = [
  { id: "opencode", displayName: "OpenCode", command: "opencode", args: ["acp"] },
  { id: "claude-code", displayName: "Claude Code", command: "claude-agent-acp", args: [] },
  { id: "codex", displayName: "Codex", command: "codex-acp", args: [] },
  { id: "gemini-cli", displayName: "Gemini CLI", command: "gemini", args: ["--experimental-acp"] },
  { id: "kiro", displayName: "Kiro", command: "kiro-cli", args: ["acp"] },
  { id: "hermes", displayName: "Hermes Agent", command: "hermes", args: ["acp"] },
  { id: "mistral-vibe", displayName: "Mistral Vibe", command: "vibe-acp", args: [] },
];

export function makePresetAgents(): Agent[] {
  return AGENT_PRESETS.map((preset) => ({
    ...preset,
    args: [...preset.args],
    env: [],
    enabled: true,
    preset: true,
  }));
}

export const DEFAULT_SETTINGS: ProsodySettings = {
  agents: makePresetAgents(),
  defaultAgentId: "opencode",
  models: {},
  modelsCache: {},
  permissionMode: "deny",
  prompt: DEFAULT_PROMPT,
  cwd: "",
  windowsWslMode: true,
  wslDistribution: "",
  debug: false,
  recorderNudgeDismissed: false,
  summaryOpen: true,
  summaryExpanded: false,
  transcriptOpen: false,
  transcriptExpanded: false,
  speakerCount: "none",
  transcriptionUrl: "http://127.0.0.1:8178",
  transcriptionToken: "",
};
