import { Platform } from "obsidian";
import type { Agent, AgentEnv, ModelOption, ProsodySettings } from "./types.ts";

export function winToWsl(path: string): string {
  const match = /^([A-Za-z]):[\\/](.*)$/.exec(path);

  if (match) {
    return "/mnt/" + match[1].toLowerCase() + "/" + match[2].replaceAll("\\", "/");
  }

  return path.replaceAll("\\", "/");
}

export function isRemote(agent: Agent): boolean {
  return /^wss?:\/\//i.test(agent.command);
}

export function fmtClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));

  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function parseEnvText(text: string): AgentEnv[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf("=");

      if (idx === -1) return { key: line, value: "" };

      return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    })
    .filter((pair) => pair.key.length > 0);
}

export function formatEnvText(env: AgentEnv[]): string {
  return env.map((pair) => `${pair.key}=${pair.value}`).join("\n");
}

export function parseLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function pickBy<T>(list: T[], predicate: (item: T) => boolean): T | null {
  return list.find(predicate) ?? list[0] ?? null;
}

/** The enabled agent to use: the selected one, or a remote agent on mobile. */
export function currentAgent(settings: ProsodySettings): Agent | null {
  const enabled = settings.agents.filter((agent) => agent.enabled);
  const selected = pickBy(enabled, (agent) => agent.id === settings.defaultAgentId);

  if (selected && (Platform.isDesktopApp || isRemote(selected))) return selected;

  if (!Platform.isDesktopApp) {
    const remote = enabled.find((agent) => isRemote(agent));

    if (remote) return remote;
  }

  return selected;
}

export interface ModelState {
  current: string;
  options: ModelOption[];
  includeCurrent: boolean;
}

/** Resolved model dropdown state for an agent, shared by the widget and modal. */
export function modelState(settings: ProsodySettings, agent: Agent | null): ModelState {
  const cached = agent ? settings.modelsCache[agent.id] : undefined;
  const current = agent ? (settings.models[agent.id] ?? "") : "";
  const options = cached?.models ?? [];

  return {
    current,
    options,
    includeCurrent: Boolean(current) && !options.some((model) => model.value === current),
  };
}

export function setModelValue(settings: ProsodySettings, agentId: string, value: string): void {
  settings.models[agentId] = value;
}

/** Human-readable label for the agent's selected model. */
export function modelLabel(settings: ProsodySettings, agent: Agent | null): string {
  const { current, options } = modelState(settings, agent);

  if (!current) return "Default model";

  return options.find((model) => model.value === current)?.name ?? current;
}
