import { Notice, Platform, Setting } from "obsidian";
import type { Agent, PluginHost } from "../types.ts";
import { formatEnvText, parseEnvText, parseLines } from "../util.ts";

type Field =
  | {
      kind: "text";
      key: "id" | "displayName" | "command";
      name: string;
      desc: string;
      custom?: boolean;
      detect?: boolean;
    }
  | { kind: "args"; name: string; desc: string }
  | { kind: "env"; name: string; desc: string };

const FIELDS: readonly Field[] = [
  {
    kind: "text",
    key: "id",
    name: "Agent ID",
    desc: "Unique identifier used to reference this agent.",
    custom: true,
  },
  {
    kind: "text",
    key: "displayName",
    name: "Display name",
    desc: "Shown in menus and headers.",
    custom: true,
  },
  {
    kind: "text",
    key: "command",
    name: "Path",
    desc: "Command name, absolute path, or a ws:// / wss:// URL. For WSL agents, this is resolved inside WSL.",
    detect: true,
  },
  {
    kind: "args",
    name: "Arguments",
    desc: "One argument per line. Leave empty to run without arguments.",
  },
  { kind: "env", name: "Environment variables", desc: "Enter KEY=VALUE pairs, one per line." },
];

function readField(agent: Agent, field: Field): string {
  if (field.kind === "args") return agent.args.join("\n");

  if (field.kind === "env") return formatEnvText(agent.env);

  return agent[field.key];
}

function writeField(agent: Agent, field: Field, value: string): void {
  if (field.kind === "args") agent.args = parseLines(value);
  else if (field.kind === "env") agent.env = parseEnvText(value);
  else agent[field.key] = value.trim();
}

function detectBinary(host: PluginHost, command: string): Promise<string | null> {
  if (!command || /^wss?:\/\//i.test(command) || !Platform.isDesktopApp)
    return Promise.resolve(null);
  const { execFile } = require("child_process") as typeof import("child_process");
  const useWsl = Platform.isWin && host.settings.windowsWslMode;
  const finder = useWsl || !Platform.isWin ? "which" : "where";
  const runner = useWsl ? "wsl.exe" : finder;

  const args = useWsl
    ? [
        ...(host.settings.wslDistribution ? ["-d", host.settings.wslDistribution] : []),
        "--",
        finder,
        command,
      ]
    : [command];

  return new Promise((resolve) => {
    execFile(runner, args, (err, stdout) => {
      if (err) {
        resolve(null);

        return;
      }

      resolve(
        stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)[0] ?? null,
      );
    });
  });
}

export function renderAgentFields(
  container: HTMLElement,
  host: PluginHost,
  agent: Agent,
  onChanged: () => void,
): void {
  for (const field of FIELDS) {
    if (field.kind === "text" && field.custom && agent.preset) continue;
    const setting = new Setting(container).setName(field.name).setDesc(field.desc);

    if (field.kind === "args" || field.kind === "env") {
      setting.addTextArea((text) => {
        text.inputEl.rows = field.kind === "env" ? 3 : 2;
        text.setValue(readField(agent, field)).onChange(async (value) => {
          writeField(agent, field, value);
          await host.saveSettings();
        });
      });
      continue;
    }

    setting.addText((text) => {
      text.setValue(readField(agent, field)).onChange(async (value) => {
        writeField(agent, field, value);
        await host.saveSettings();
      });
    });

    if (field.detect && Platform.isDesktopApp) {
      setting.addExtraButton((button) =>
        button
          .setIcon("search")
          .setTooltip("Auto-detect path")
          .onClick(async () => {
            const found = await detectBinary(host, agent.command);

            if (!found) {
              new Notice("Prosody: not found. Check the command or set an absolute path.");

              return;
            }

            agent.command = found;
            await host.saveSettings();
            onChanged();
          }),
      );
    }
  }
}
