import { Platform } from "obsidian";
import { CLIENT_INFO, PROTOCOL_VERSION } from "../constants.ts";
import type {
  AcpConfigOption,
  Agent,
  ModelCache,
  ProsodySettings,
  SessionUpdateParams,
} from "../types.ts";
import { isRemote, winToWsl } from "../util.ts";
import { AcpClient } from "./client.ts";

export function sessionCwd(agent: Agent, settings: ProsodySettings, vaultPath: string): string {
  const configured = settings.cwd.trim();

  if (isRemote(agent)) return configured || "/";
  const base = configured || vaultPath;

  if (Platform.isWin && settings.windowsWslMode) return winToWsl(base) || "/";

  return base || "/";
}

export function findModelOption(
  configOptions: AcpConfigOption[] | undefined,
): AcpConfigOption | null {
  return (
    (configOptions ?? []).find(
      (option) =>
        option.type === "select" && (option.category === "model" || option.id === "model"),
    ) ?? null
  );
}

function modelCache(option: AcpConfigOption | null): ModelCache {
  return { models: option?.options ?? [], current: option?.currentValue ?? null };
}

interface Session {
  client: AcpClient;
  sessionId: string;
  configOptions: AcpConfigOption[] | undefined;
}

async function openSession(
  agent: Agent,
  settings: ProsodySettings,
  vaultPath: string,
  onUpdate?: (params: SessionUpdateParams) => void,
): Promise<Session> {
  const client = new AcpClient({
    permissionMode: settings.permissionMode,
    debug: settings.debug,
    onUpdate,
  });

  await client.connect(agent, settings, vaultPath);
  await client.request("initialize", {
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    clientInfo: CLIENT_INFO,
  });

  const session = await client.request<{ sessionId: string; configOptions?: AcpConfigOption[] }>(
    "session/new",
    { cwd: sessionCwd(agent, settings, vaultPath), mcpServers: [] },
  );

  return { client, sessionId: session.sessionId, configOptions: session.configOptions };
}

export async function fetchModels(
  agent: Agent,
  settings: ProsodySettings,
  vaultPath: string,
): Promise<ModelCache> {
  const session = await openSession(agent, settings, vaultPath);

  try {
    return modelCache(findModelOption(session.configOptions));
  } finally {
    session.client.close();
  }
}

export async function runSummary(
  agent: Agent,
  settings: ProsodySettings,
  vaultPath: string,
  transcript: string,
  onChunk: (text: string) => void,
): Promise<ModelCache> {
  const session = await openSession(agent, settings, vaultPath, (params) => {
    const update = params.update;

    if (update?.sessionUpdate === "agent_message_chunk" && update.content?.text) {
      onChunk(update.content.text);
    }
  });

  try {
    const option = findModelOption(session.configOptions);
    const desired = settings.models[agent.id];

    if (option && desired && desired !== option.currentValue) {
      await session.client.request("session/set_config_option", {
        sessionId: session.sessionId,
        configId: option.id,
        value: desired,
      });
    }

    await session.client.request("session/prompt", {
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: `${settings.prompt}\n\n---\n\n${transcript}` }],
    });

    return modelCache(option);
  } finally {
    session.client.close();
  }
}
