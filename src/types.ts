import type { App } from "obsidian";

export interface AgentEnv {
  key: string;
  value: string;
}

export interface Agent {
  id: string;
  displayName: string;
  command: string;
  args: string[];
  env: AgentEnv[];
  enabled: boolean;
  preset: boolean;
}

export interface ModelOption {
  value: string;
  name?: string;
}

export interface ModelCache {
  models: ModelOption[];
  current: string | null;
}

export interface AcpConfigOption {
  id: string;
  name?: string;
  category?: string;
  type: string;
  currentValue?: string;
  options?: ModelOption[];
}

export interface NewSessionResult {
  sessionId: string;
  configOptions?: AcpConfigOption[];
}

export interface Word {
  w: string;
  s?: number;
  e?: number;
  speaker?: number;
}

export interface Segment {
  start: number;
  end: number;
  text: string;
  words: Word[];
}

export interface Sidecar {
  text?: string;
  words?: Word[];
  segments?: Segment[];
  summary?: string;
}

export type PermissionMode = "deny" | "allow";

export interface ProsodySettings {
  agents: Agent[];
  defaultAgentId: string;
  models: Record<string, string>;
  modelsCache: Record<string, ModelCache>;
  permissionMode: PermissionMode;
  prompt: string;
  cwd: string;
  windowsWslMode: boolean;
  wslDistribution: string;
  debug: boolean;
  recorderNudgeDismissed: boolean;
  summaryOpen: boolean;
  summaryExpanded: boolean;
  transcriptOpen: boolean;
  transcriptExpanded: boolean;
}

export interface SessionUpdate {
  sessionUpdate?: string;
  content?: { type?: string; text?: string };
}

export interface SessionUpdateParams {
  sessionId?: string;
  update?: SessionUpdate;
}

export interface PermissionOption {
  optionId: string;
  name?: string;
  kind?: string;
}

export interface PermissionRequestParams {
  sessionId?: string;
  options?: PermissionOption[];
}

export interface PluginHost {
  app: App;
  manifest: { id: string };
  settings: ProsodySettings;
  saveSettings(): Promise<void>;
  vaultPath(): string;
  recorderEnabled(): boolean;
}
