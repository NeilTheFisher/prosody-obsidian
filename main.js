"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => main_default
});
module.exports = __toCommonJS(main_exports);

// src/plugin.ts
var import_obsidian10 = require("obsidian");

// src/constants.ts
var PROTOCOL_VERSION = 1;
var CLIENT_INFO = {
  name: "prosody-obsidian",
  title: "Prosody",
  version: "0.2.0"
};
var FENCES = ["prosody", "voice-sync"];
var DEFAULT_PROMPT = 'The attached text is a voice-note transcript. Summarize it as concise markdown: a one-line gist, then the key points as bullets. If there are follow-ups or todos to check off for later, add a short "Action items" section using markdown checkboxes. Do not invent tasks. Return only the summary.';
var AGENT_PRESETS = [
  { id: "opencode", displayName: "OpenCode", command: "opencode", args: ["acp"] },
  { id: "claude-code", displayName: "Claude Code", command: "claude-agent-acp", args: [] },
  { id: "codex", displayName: "Codex", command: "codex-acp", args: [] },
  { id: "gemini-cli", displayName: "Gemini CLI", command: "gemini", args: ["--experimental-acp"] },
  { id: "kiro", displayName: "Kiro", command: "kiro-cli", args: ["acp"] },
  { id: "hermes", displayName: "Hermes Agent", command: "hermes", args: ["acp"] },
  { id: "mistral-vibe", displayName: "Mistral Vibe", command: "vibe-acp", args: [] }
];
function makePresetAgents() {
  return AGENT_PRESETS.map((preset) => ({
    ...preset,
    args: [...preset.args],
    env: [],
    enabled: true,
    preset: true
  }));
}
var DEFAULT_SETTINGS = {
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
  transcriptionToken: ""
};

// src/ui/settingsTab.ts
var import_obsidian3 = require("obsidian");

// src/ui/agentFields.ts
var import_obsidian2 = require("obsidian");

// src/util.ts
var import_obsidian = require("obsidian");
function winToWsl(path) {
  const match = /^([A-Za-z]):[\\/](.*)$/.exec(path);
  if (match) {
    return "/mnt/" + match[1].toLowerCase() + "/" + match[2].replaceAll("\\", "/");
  }
  return path.replaceAll("\\", "/");
}
function isRemote(agent) {
  return /^wss?:\/\//i.test(agent.command);
}
function fmtClock(seconds) {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
function parseEnvText(text) {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const idx = line.indexOf("=");
    if (idx === -1) return { key: line, value: "" };
    return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
  }).filter((pair) => pair.key.length > 0);
}
function formatEnvText(env) {
  return env.map((pair) => `${pair.key}=${pair.value}`).join("\n");
}
function parseLines(text) {
  return text.split("\n").map((line) => line.trim()).filter(Boolean);
}
function pickBy(list, predicate) {
  return list.find(predicate) ?? list[0] ?? null;
}
function currentAgent(settings) {
  const enabled = settings.agents.filter((agent) => agent.enabled);
  const selected = pickBy(enabled, (agent) => agent.id === settings.defaultAgentId);
  if (selected && (import_obsidian.Platform.isDesktopApp || isRemote(selected))) return selected;
  if (!import_obsidian.Platform.isDesktopApp) {
    const remote = enabled.find((agent) => isRemote(agent));
    if (remote) return remote;
  }
  return selected;
}
function modelState(settings, agent) {
  const cached = agent ? settings.modelsCache[agent.id] : void 0;
  const current = agent ? settings.models[agent.id] ?? "" : "";
  const options = cached?.models ?? [];
  return {
    current,
    options,
    includeCurrent: Boolean(current) && !options.some((model) => model.value === current)
  };
}
function setModelValue(settings, agentId, value) {
  settings.models[agentId] = value;
}
function modelLabel(settings, agent) {
  const { current, options } = modelState(settings, agent);
  if (!current) return "Default model";
  return options.find((model) => model.value === current)?.name ?? current;
}

// src/ui/agentFields.ts
var FIELDS = [
  {
    kind: "text",
    key: "id",
    name: "Agent ID",
    desc: "Unique identifier used to reference this agent.",
    custom: true
  },
  {
    kind: "text",
    key: "displayName",
    name: "Display name",
    desc: "Shown in menus and headers.",
    custom: true
  },
  {
    kind: "text",
    key: "command",
    name: "Path",
    desc: "Command name, absolute path, or a ws:// / wss:// URL. For WSL agents, this is resolved inside WSL.",
    detect: true
  },
  {
    kind: "args",
    name: "Arguments",
    desc: "One argument per line. Leave empty to run without arguments."
  },
  { kind: "env", name: "Environment variables", desc: "Enter KEY=VALUE pairs, one per line." }
];
function readField(agent, field) {
  if (field.kind === "args") return agent.args.join("\n");
  if (field.kind === "env") return formatEnvText(agent.env);
  return agent[field.key];
}
function writeField(agent, field, value) {
  if (field.kind === "args") agent.args = parseLines(value);
  else if (field.kind === "env") agent.env = parseEnvText(value);
  else agent[field.key] = value.trim();
}
function detectBinary(host, command) {
  if (!command || /^wss?:\/\//i.test(command) || !import_obsidian2.Platform.isDesktopApp)
    return Promise.resolve(null);
  const { execFile } = require("child_process");
  const useWsl = import_obsidian2.Platform.isWin && host.settings.windowsWslMode;
  const finder = useWsl || !import_obsidian2.Platform.isWin ? "which" : "where";
  const runner = useWsl ? "wsl.exe" : finder;
  const args = useWsl ? [
    ...host.settings.wslDistribution ? ["-d", host.settings.wslDistribution] : [],
    "--",
    finder,
    command
  ] : [command];
  return new Promise((resolve) => {
    execFile(runner, args, (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }
      resolve(
        stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0] ?? null
      );
    });
  });
}
function renderAgentFields(container, host, agent, onChanged) {
  for (const field of FIELDS) {
    if (field.kind === "text" && field.custom && agent.preset) continue;
    const setting = new import_obsidian2.Setting(container).setName(field.name).setDesc(field.desc);
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
    if (field.detect && import_obsidian2.Platform.isDesktopApp) {
      setting.addExtraButton(
        (button) => button.setIcon("search").setTooltip("Auto-detect path").onClick(async () => {
          const found = await detectBinary(host, agent.command);
          if (!found) {
            new import_obsidian2.Notice("Prosody: not found. Check the command or set an absolute path.");
            return;
          }
          agent.command = found;
          await host.saveSettings();
          onChanged();
        })
      );
    }
  }
}

// src/ui/settingsTab.ts
function renderAgentRow(container, host, agent, onChanged) {
  const card = container.createDiv({ cls: "prosody-agent" });
  if (!agent.enabled) card.addClass("is-disabled");
  const header = card.createDiv({ cls: "prosody-agent-header" });
  const chevron = header.createDiv({ cls: "prosody-agent-chevron" });
  (0, import_obsidian3.setIcon)(chevron, "chevron-right");
  header.createDiv({ cls: "prosody-agent-name", text: agent.displayName || agent.id });
  header.createDiv({ cls: "prosody-agent-spacer" });
  const toggle = header.createEl("input", {
    cls: "prosody-agent-toggle",
    attr: { type: "checkbox" }
  });
  toggle.checked = agent.enabled;
  toggle.addEventListener("change", async () => {
    agent.enabled = toggle.checked;
    card.toggleClass("is-disabled", !toggle.checked);
    await host.saveSettings();
    onChanged();
  });
  if (!agent.preset) {
    const remove = header.createDiv({ cls: "prosody-agent-remove clickable-icon" });
    (0, import_obsidian3.setIcon)(remove, "trash");
    remove.setAttribute("aria-label", "Remove agent");
    remove.addEventListener("click", async (event) => {
      event.stopPropagation();
      host.settings.agents = host.settings.agents.filter((candidate) => candidate !== agent);
      await host.saveSettings();
      onChanged();
    });
  }
  header.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && (target.closest("input") ?? target.closest(".prosody-agent-remove"))) {
      return;
    }
    card.toggleClass("is-open", !card.hasClass("is-open"));
  });
  const body = card.createDiv({ cls: "prosody-agent-body" });
  renderAgentFields(body, host, agent, onChanged);
}
var ProsodySettingsTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, host) {
    super(app, host);
    __publicField(this, "host");
    this.host = host;
  }
  display() {
    const { containerEl } = this;
    const settings = this.host.settings;
    const rerender = () => {
      this.display();
    };
    containerEl.empty();
    containerEl.addClass("prosody-settings");
    containerEl.createEl("h2", { text: "Prosody" });
    if (!this.host.recorderEnabled()) {
      const hint = containerEl.createDiv({ cls: "prosody-hint" });
      hint.createEl("strong", { text: "Audio Recorder is off. " });
      hint.createSpan({
        text: "Prosody uses Obsidian's built-in Audio Recorder to capture voice notes into your vault; it transcribes them automatically."
      });
      const enable = hint.createEl("button", { text: "Enable", cls: "mod-cta" });
      enable.addEventListener("click", () => {
        this.host.enableRecorder();
        rerender();
      });
    }
    this.dropdown(
      containerEl,
      "Default agent",
      "Used to summarize transcripts.",
      settings.agents.map((agent) => [agent.id, agent.displayName || agent.id]),
      () => settings.defaultAgentId,
      (value) => {
        settings.defaultAgentId = value;
      }
    );
    this.dropdown(
      containerEl,
      "Permissions",
      "Whether agents may use tools while summarizing. Auto-deny is safer.",
      [
        ["deny", "Auto-deny"],
        ["allow", "Auto-allow"]
      ],
      () => settings.permissionMode,
      (value) => {
        settings.permissionMode = value === "allow" ? "allow" : "deny";
      }
    );
    containerEl.createEl("h3", { text: "Windows Subsystem for Linux" });
    this.toggle(
      containerEl,
      "Enable WSL mode",
      "Run agents inside WSL. Recommended for agents that don't work in native Windows.",
      () => settings.windowsWslMode,
      (value) => {
        settings.windowsWslMode = value;
      }
    );
    this.text(
      containerEl,
      "WSL distribution",
      "Specific WSL distribution name (leave empty for default). Example: Ubuntu",
      () => settings.wslDistribution,
      (value) => {
        settings.wslDistribution = value.trim();
      },
      "Leave empty for default"
    );
    containerEl.createEl("h3", { text: "Preset agents" });
    for (const agent of settings.agents.filter((candidate) => candidate.preset)) {
      renderAgentRow(containerEl, this.host, agent, rerender);
    }
    containerEl.createEl("h3", { text: "Custom agents" });
    const customs = settings.agents.filter((agent) => !agent.preset);
    if (customs.length === 0) {
      containerEl.createEl("p", { cls: "prosody-empty", text: "No custom agents yet." });
    }
    for (const agent of customs) renderAgentRow(containerEl, this.host, agent, rerender);
    new import_obsidian3.Setting(containerEl).setName("New custom agent").setDesc("Register any ACP-compatible agent, command, or ws:// URL.").addButton(
      (button) => button.setButtonText("Add custom agent").setCta().onClick(async () => {
        settings.agents.push({
          id: "agent-" + Date.now(),
          displayName: "New agent",
          command: "",
          args: [],
          env: [],
          enabled: true,
          preset: false
        });
        await this.host.saveSettings();
        rerender();
      })
    );
    containerEl.createEl("h3", { text: "Advanced" });
    let resetPrompt;
    new import_obsidian3.Setting(containerEl).setName("Prompt").setDesc("Instructions sent with the transcript.").setClass("prosody-prompt-setting").addTextArea((text) => {
      text.inputEl.rows = 5;
      text.setValue(settings.prompt).onChange(async (value) => {
        settings.prompt = value;
        await this.persist();
        resetPrompt?.setDisabled(value === DEFAULT_PROMPT);
      });
    }).addExtraButton((button) => {
      resetPrompt = button;
      button.setIcon("rotate-ccw").setTooltip("Reset to default").setDisabled(settings.prompt === DEFAULT_PROMPT).onClick(async () => {
        settings.prompt = DEFAULT_PROMPT;
        await this.persist();
        rerender();
      });
    });
    this.text(
      containerEl,
      "Working directory",
      "Empty = vault root. For WSL agents this is passed as --cd.",
      () => settings.cwd,
      (value) => {
        settings.cwd = value.trim();
      }
    );
    this.text(
      containerEl,
      "Transcription URL",
      "OpenAI-compatible endpoint used to (re-)transcribe audio. Use the LAN address (e.g. http://192.168.0.46:8178) so phones can reach it.",
      () => settings.transcriptionUrl,
      (value) => {
        settings.transcriptionUrl = value.trim();
      }
    );
    this.text(
      containerEl,
      "Transcription token",
      "Sent as a Bearer token when transcribing. Required for non-localhost requests when the server sets ORUKEET_TOKEN.",
      () => settings.transcriptionToken,
      (value) => {
        settings.transcriptionToken = value.trim();
      }
    );
    this.toggle(
      containerEl,
      "Debug logging",
      "",
      () => settings.debug,
      (value) => {
        settings.debug = value;
      }
    );
    new import_obsidian3.Setting(containerEl).setName("Reset preset agents").setDesc("Restore the built-in agent list. Custom agents are kept.").addButton(
      (button) => button.setButtonText("Reset").onClick(async () => {
        const kept = settings.agents.filter((agent) => !agent.preset);
        settings.agents = [...makePresetAgents(), ...kept];
        await this.host.saveSettings();
        rerender();
      })
    );
  }
  async persist() {
    await this.host.saveSettings();
  }
  toggle(container, name, desc, get, set) {
    new import_obsidian3.Setting(container).setName(name).setDesc(desc).addToggle(
      (toggle) => toggle.setValue(get()).onChange(async (value) => {
        set(value);
        await this.persist();
      })
    );
  }
  text(container, name, desc, get, set, placeholder) {
    new import_obsidian3.Setting(container).setName(name).setDesc(desc).addText((text) => {
      if (placeholder) text.setPlaceholder(placeholder);
      text.setValue(get()).onChange(async (value) => {
        set(value);
        await this.persist();
      });
    });
  }
  dropdown(container, name, desc, options, get, set) {
    new import_obsidian3.Setting(container).setName(name).setDesc(desc).addDropdown((dropdown) => {
      for (const [value, label] of options) dropdown.addOption(value, label);
      dropdown.setValue(get()).onChange(async (value) => {
        set(value);
        await this.persist();
      });
    });
  }
};

// src/ui/widget.ts
var import_obsidian9 = require("obsidian");

// src/acp/session.ts
var import_obsidian5 = require("obsidian");

// src/acp/client.ts
var import_obsidian4 = require("obsidian");
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function toError(value) {
  if (isRecord(value)) {
    const message = value["message"];
    if (typeof message === "string") return new Error(message);
  }
  return new Error(typeof value === "string" ? value : "Agent error");
}
var AcpClient = class {
  constructor(options) {
    __publicField(this, "permissionMode");
    __publicField(this, "debug");
    __publicField(this, "onUpdate");
    __publicField(this, "pending", /* @__PURE__ */ new Map());
    __publicField(this, "nextId", 1);
    __publicField(this, "buffer", "");
    __publicField(this, "socket", null);
    __publicField(this, "process", null);
    this.permissionMode = options.permissionMode;
    this.debug = options.debug;
    this.onUpdate = options.onUpdate;
  }
  log(message) {
    if (this.debug) console.log("[prosody] " + message);
  }
  connect(agent, settings, cwd) {
    if (isRemote(agent)) return this.connectWebSocket(agent.command);
    return this.connectStdio(agent, settings, cwd);
  }
  connectWebSocket(url) {
    return new Promise((resolve, reject) => {
      let socket;
      try {
        socket = new WebSocket(url);
      } catch {
        reject(new Error("Invalid WebSocket URL: " + url));
        return;
      }
      this.socket = socket;
      socket.binaryType = "arraybuffer";
      const timer = setTimeout(() => {
        reject(new Error("WebSocket connection timed out"));
      }, 2e4);
      socket.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(new Error("WebSocket error: " + url));
      };
      socket.onmessage = async (event) => {
        const data = event.data;
        if (typeof data === "string") this.receive(data);
        else if (data instanceof ArrayBuffer) this.receive(new TextDecoder().decode(data));
        else if (data instanceof Blob) this.receive(await data.text());
      };
    });
  }
  connectStdio(agent, settings, cwd) {
    if (!import_obsidian4.Platform.isDesktopApp) {
      return Promise.reject(
        new Error("Local agents need the desktop app. Use a ws:// agent URL on mobile.")
      );
    }
    const { spawn } = require("child_process");
    const useWsl = import_obsidian4.Platform.isWin && settings.windowsWslMode;
    const command = useWsl ? "wsl.exe" : agent.command;
    const args = useWsl ? [
      ...settings.wslDistribution ? ["-d", settings.wslDistribution] : [],
      "--cd",
      winToWsl(cwd) || "/",
      "--",
      agent.command,
      ...agent.args
    ] : agent.args;
    this.log(`spawn ${command} ${args.join(" ")}`);
    this.process = spawn(command, args, {
      cwd: useWsl ? void 0 : cwd || void 0,
      env: {
        ...process.env,
        ...Object.fromEntries(agent.env.map((pair) => [pair.key, pair.value]))
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.process.stdout?.on("data", (data) => {
      this.receive(data.toString());
    });
    this.process.stderr?.on("data", (data) => {
      this.log("[stderr] " + data.toString().trim());
    });
    this.process.on("exit", () => {
      for (const pending of this.pending.values())
        pending.reject(new Error("Agent process exited"));
      this.pending.clear();
    });
    return Promise.resolve();
  }
  receive(chunk) {
    this.buffer += chunk;
    let index = this.buffer.indexOf("\n");
    while (index >= 0) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (line) {
        try {
          this.handle(JSON.parse(line));
        } catch {
          this.log("non-json line: " + line.slice(0, 200));
        }
      }
      index = this.buffer.indexOf("\n");
    }
  }
  write(message) {
    const payload = JSON.stringify(message) + "\n";
    if (this.socket) this.socket.send(payload);
    else this.process?.stdin?.write(payload);
  }
  handle(raw) {
    if (!isRecord(raw)) return;
    const id = raw["id"];
    const method = raw["method"];
    if (typeof id === "number" && ("result" in raw || "error" in raw)) {
      this.settle(id, raw["result"], raw["error"]);
      return;
    }
    if (method === "session/update") {
      this.onUpdate?.(raw["params"]);
      return;
    }
    if (method === "session/request_permission") {
      this.respondToPermission(id, raw["params"]);
      return;
    }
    if (typeof id === "number") {
      this.write({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not supported" } });
    }
  }
  settle(id, result, error) {
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    if (error === void 0) pending.resolve(result);
    else pending.reject(toError(error));
  }
  respondToPermission(id, params) {
    const options = params.options ?? [];
    const wanted = this.permissionMode === "allow" ? "allow" : "reject";
    const option = options.find((candidate) => (candidate.kind ?? "").startsWith(wanted)) ?? (this.permissionMode === "allow" ? options[0] : void 0);
    const result = option ? { outcome: { outcome: "selected", optionId: option.optionId } } : { outcome: { outcome: "cancelled" } };
    if (typeof id === "number") this.write({ jsonrpc: "2.0", id, result });
  }
  request(method, params) {
    const id = this.nextId++;
    this.write({ jsonrpc: "2.0", id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => {
          resolve(value);
        },
        reject
      });
    });
  }
  close() {
    try {
      this.socket?.close();
    } catch {
    }
    try {
      this.process?.kill();
    } catch {
    }
  }
};

// src/acp/session.ts
function sessionCwd(agent, settings, vaultPath) {
  const configured = settings.cwd.trim();
  if (isRemote(agent)) return configured || "/";
  const base = configured || vaultPath;
  if (import_obsidian5.Platform.isWin && settings.windowsWslMode) return winToWsl(base) || "/";
  return base || "/";
}
function findModelOption(configOptions) {
  return (configOptions ?? []).find(
    (option) => option.type === "select" && (option.category === "model" || option.id === "model")
  ) ?? null;
}
function modelCache(option) {
  return { models: option?.options ?? [], current: option?.currentValue ?? null };
}
async function openSession(agent, settings, vaultPath, onUpdate) {
  const client = new AcpClient({
    permissionMode: settings.permissionMode,
    debug: settings.debug,
    onUpdate
  });
  await client.connect(agent, settings, vaultPath);
  await client.request("initialize", {
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    clientInfo: CLIENT_INFO
  });
  const session = await client.request(
    "session/new",
    { cwd: sessionCwd(agent, settings, vaultPath), mcpServers: [] }
  );
  return { client, sessionId: session.sessionId, configOptions: session.configOptions };
}
async function fetchModels(agent, settings, vaultPath) {
  const session = await openSession(agent, settings, vaultPath);
  try {
    return modelCache(findModelOption(session.configOptions));
  } finally {
    session.client.close();
  }
}
async function runSummary(agent, settings, vaultPath, transcript, onChunk) {
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
        value: desired
      });
    }
    await session.client.request("session/prompt", {
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: `${settings.prompt}

---

${transcript}` }]
    });
    return modelCache(option);
  } finally {
    session.client.close();
  }
}

// src/ui/modelPicker.ts
var import_obsidian6 = require("obsidian");
var ModelPickerModal = class extends import_obsidian6.FuzzySuggestModal {
  constructor(app, choices, choose) {
    super(app);
    __publicField(this, "choices");
    __publicField(this, "choose");
    this.choices = choices;
    this.choose = choose;
    this.setPlaceholder("Search models\u2026");
  }
  getItems() {
    return this.choices;
  }
  getItemText(item) {
    return item.label;
  }
  onChooseItem(item) {
    void this.choose(item.value);
  }
};
function openModelPicker(host, agent, onPicked) {
  const state = modelState(host.settings, agent);
  const choices = [{ label: "Default model", value: "" }];
  for (const model of state.options) {
    choices.push({ label: model.name || model.value, value: model.value });
  }
  if (state.includeCurrent) {
    choices.push({ label: state.current, value: state.current });
  }
  new ModelPickerModal(host.app, choices, async (value) => {
    if (agent) setModelValue(host.settings, agent.id, value);
    await host.saveSettings();
    onPicked();
  }).open();
}

// src/ui/modal.ts
var import_obsidian7 = require("obsidian");
var ProsodyModal = class extends import_obsidian7.Modal {
  constructor(app, host, onRetranscribe) {
    super(app);
    __publicField(this, "host");
    __publicField(this, "onRetranscribe");
    this.host = host;
    this.onRetranscribe = onRetranscribe;
  }
  onOpen() {
    const settings = this.host.settings;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Prosody" });
    const agents = settings.agents.filter((candidate) => candidate.enabled);
    const agent = currentAgent(settings);
    const rerender = () => {
      this.onOpen();
    };
    new import_obsidian7.Setting(contentEl).setName("Agent").addDropdown((dropdown) => {
      for (const candidate of agents) {
        dropdown.addOption(candidate.id, candidate.displayName || candidate.id);
      }
      dropdown.setValue(agent ? agent.id : "");
      dropdown.onChange(async (value) => {
        settings.defaultAgentId = value;
        await this.host.saveSettings();
        rerender();
      });
    });
    const { options } = modelState(settings, agent);
    const modelSetting = new import_obsidian7.Setting(contentEl).setName("Model").setDesc(options.length > 0 ? "" : "Refresh to load models from the agent.");
    modelSetting.addButton(
      (button) => button.setButtonText(modelLabel(settings, agent)).onClick(() => {
        openModelPicker(this.host, agent, rerender);
      })
    );
    modelSetting.addExtraButton(
      (button) => button.setIcon("refresh-cw").setTooltip("Refresh models from the agent").onClick(async () => {
        if (!agent) return;
        button.setDisabled(true);
        try {
          const result = await fetchModels(agent, settings, this.host.vaultPath());
          settings.modelsCache[agent.id] = result;
          await this.host.saveSettings();
          new import_obsidian7.Notice(`Prosody: loaded ${result.models.length} models`);
        } catch (err) {
          new import_obsidian7.Notice("Prosody: " + (err instanceof Error ? err.message : String(err)));
        } finally {
          button.setDisabled(false);
          rerender();
        }
      })
    );
    new import_obsidian7.Setting(contentEl).setName("Permissions").setDesc("Tool requests during summarization").addDropdown(
      (dropdown) => dropdown.addOption("deny", "Auto-deny").addOption("allow", "Auto-allow").setValue(settings.permissionMode).onChange(async (value) => {
        settings.permissionMode = value === "allow" ? "allow" : "deny";
        await this.host.saveSettings();
      })
    );
    new import_obsidian7.Setting(contentEl).setName("Speakers").setDesc(
      "Label speakers during transcription. Auto is unreliable on long recordings; pick a number when you know how many there are."
    ).addDropdown((dropdown) => {
      dropdown.addOption("none", "Off");
      dropdown.addOption("auto", "Auto");
      for (const count of [2, 3, 4, 5, 6]) dropdown.addOption(String(count), `${count} speakers`);
      dropdown.setValue(settings.speakerCount).onChange(async (value) => {
        settings.speakerCount = value;
        await this.host.saveSettings();
      });
    });
    if (this.onRetranscribe) {
      new import_obsidian7.Setting(contentEl).setName("Re-transcribe").setDesc("Re-run transcription for this recording using the speakers setting above.").addButton(
        (button) => button.setButtonText("Re-transcribe").setCta().onClick(async () => {
          button.setDisabled(true);
          button.setButtonText("Transcribing\u2026");
          try {
            await this.onRetranscribe?.();
          } finally {
            this.close();
          }
        })
      );
    }
    new import_obsidian7.Setting(contentEl).addButton(
      (button) => button.setButtonText("Open full settings").onClick(() => {
        this.close();
        const app = this.app;
        app.setting.open();
        app.setting.openTabById(this.host.manifest.id);
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/ui/section.ts
var import_obsidian8 = require("obsidian");
function buildSection(wrap, options) {
  const details = wrap.createEl("details", { cls: "vs-head " + options.cls });
  details.open = options.open;
  details.toggleClass("is-expanded", options.expanded);
  const head = details.createEl("summary", { cls: "vs-summary" });
  const chevron = head.createSpan({ cls: "vs-chevron" });
  (0, import_obsidian8.setIcon)(chevron, "chevron-right");
  const icon = head.createSpan({ cls: "vs-ico" });
  (0, import_obsidian8.setIcon)(icon, options.icon);
  head.createSpan({ cls: "vs-label", text: options.label });
  if (options.meta) head.createSpan({ cls: "vs-meta", text: options.meta });
  const expand = head.createEl("button", {
    cls: "vs-expand",
    attr: { type: "button", "aria-label": "Toggle section height" }
  });
  const expandIcon = expand.createSpan({ cls: "vs-btn-ico" });
  const refreshExpand = () => {
    const isExpanded = details.hasClass("is-expanded");
    (0, import_obsidian8.setIcon)(expandIcon, isExpanded ? "chevrons-up" : "chevrons-down");
    (0, import_obsidian8.setTooltip)(expand, isExpanded ? "Collapse height" : "Expand height");
    expand.disabled = !details.open;
  };
  details.addEventListener("toggle", () => {
    options.onOpenChange(details.open);
    refreshExpand();
  });
  expand.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const next = !details.hasClass("is-expanded");
    details.toggleClass("is-expanded", next);
    options.onExpandChange(next);
    refreshExpand();
  });
  const scroller = details.createDiv({ cls: "vs-body" });
  const body = scroller.createDiv({ cls: "vs-text" });
  refreshExpand();
  return { details, body, scroller, expand };
}

// src/ui/widget.ts
var ProsodyView = class extends import_obsidian9.MarkdownRenderChild {
  constructor(el, host, source, sourcePath) {
    super(el);
    __publicField(this, "host");
    __publicField(this, "audioName");
    __publicField(this, "sourcePath");
    __publicField(this, "audioFile", null);
    __publicField(this, "sidecarPath", "");
    __publicField(this, "sidecar", null);
    this.host = host;
    this.audioName = (source.trim().split("\n")[0] ?? "").trim();
    this.sourcePath = sourcePath;
  }
  resetInheritedStyles() {
    let node = this.containerEl;
    for (let depth = 0; depth < 3; depth++) {
      node.style.whiteSpace = "normal";
      node.style.overflow = "visible";
      node.style.background = "none";
      node.style.border = "none";
      node.style.padding = "0";
      node.style.margin = "0";
      const parent = node.parentElement;
      if (!parent || parent.tagName === "PRE") {
        if (parent) {
          parent.style.whiteSpace = "normal";
          parent.style.overflow = "visible";
        }
        break;
      }
      node = parent;
    }
  }
  state(wrap, icon, text, isError = false) {
    const el = wrap.createDiv({ cls: "vs-state" + (isError ? " vs-error" : "") });
    const iconEl = el.createSpan({ cls: "vs-state-ico" });
    (0, import_obsidian9.setIcon)(iconEl, icon);
    el.createSpan({ text });
  }
  async onload() {
    this.containerEl.addClass("prosody-root");
    this.resetInheritedStyles();
    await this.render();
  }
  async render() {
    this.containerEl.empty();
    const wrap = this.containerEl.createDiv({ cls: "prosody" });
    if (!this.audioName) {
      this.state(wrap, "file-warning", "No audio file specified.", true);
      return;
    }
    const file = this.host.app.metadataCache.getFirstLinkpathDest(this.audioName, this.sourcePath);
    if (!file) {
      this.state(wrap, "file-warning", "Audio not found in this vault: " + this.audioName, true);
      return;
    }
    this.audioFile = file;
    this.sidecarPath = file.path.replace(/\.[^.]+$/, ".json");
    this.sidecar = await this.readSidecar();
    if (!this.sidecar?.words?.length) {
      this.state(wrap, "hourglass", "Transcript is on its way once the local service finishes.");
      return;
    }
    const audio = wrap.createEl("audio", { attr: { controls: "", preload: "metadata" } });
    audio.src = this.host.app.vault.adapter.getResourcePath(file.path);
    this.renderTranscript(wrap, this.sidecar, audio);
    const summary = this.renderSummary(wrap, this.sidecar);
    this.buildToolbar(wrap, summary);
  }
  async readSidecar() {
    try {
      if (!await this.host.app.vault.adapter.exists(this.sidecarPath)) return null;
      return JSON.parse(await this.host.app.vault.adapter.read(this.sidecarPath));
    } catch (err) {
      console.error("prosody: failed to read sidecar", this.sidecarPath, err);
      return null;
    }
  }
  renderTranscript(wrap, data, audio) {
    const words = data.words ?? [];
    const lastSegment = data.segments?.at(-1);
    const meta = [`${words.length.toLocaleString()} words`];
    if (lastSegment) meta.push(fmtClock(lastSegment.end));
    const section = buildSection(
      wrap,
      this.sectionOptions("transcript", {
        cls: "vs-transcript-head",
        icon: "audio-lines",
        label: "Transcript",
        meta: meta.join(" \xB7 ")
      })
    );
    this.renderWords(section.body, words, audio);
  }
  sectionOptions(kind, base) {
    const settings = this.host.settings;
    const openKey = kind === "transcript" ? "transcriptOpen" : "summaryOpen";
    const expandedKey = kind === "transcript" ? "transcriptExpanded" : "summaryExpanded";
    return {
      ...base,
      open: settings[openKey],
      expanded: settings[expandedKey],
      onOpenChange: (open) => {
        settings[openKey] = open;
        void this.host.saveSettings();
      },
      onExpandChange: (expanded) => {
        settings[expandedKey] = expanded;
        void this.host.saveSettings();
      }
    };
  }
  renderWords(text, words, audio) {
    const hasSpeakers = words.some((word) => typeof word.speaker === "number");
    const spans = [];
    let container = text;
    let speaker = null;
    for (const word of words) {
      const wordSpeaker = typeof word.speaker === "number" ? word.speaker : null;
      if (hasSpeakers && wordSpeaker !== speaker) {
        speaker = wordSpeaker;
        const utterance = text.createDiv({ cls: "vs-utterance" });
        utterance.createDiv({
          cls: "vs-speaker",
          text: `Speaker ${speaker === null ? "?" : speaker + 1}`
        });
        container = utterance.createDiv({ cls: "vs-utterance-text" });
      }
      const span = container.createSpan({ cls: "vs-word", text: word.w });
      span.setAttribute("title", "Jump to this word");
      span.addEventListener("click", () => {
        if (typeof word.s === "number") {
          audio.currentTime = Math.max(0, word.s - 0.05);
          void audio.play();
        }
      });
      container.appendText(" ");
      spans.push(span);
    }
    let active = -1;
    const highlight = (index) => {
      if (index === active) return;
      if (active >= 0) spans[active].removeClass("vs-active");
      active = index;
      const span = index >= 0 ? spans[index] : void 0;
      if (span) {
        span.addClass("vs-active");
        span.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      }
    };
    const sync = () => {
      const time = audio.currentTime;
      let index = -1;
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (typeof word.s !== "number" || time < word.s) continue;
        index = i;
        if (typeof word.e === "number" && time < word.e) break;
      }
      highlight(index);
    };
    this.registerDomEvent(audio, "timeupdate", sync);
    this.registerDomEvent(audio, "seeked", sync);
  }
  renderSummary(wrap, data) {
    const section = buildSection(
      wrap,
      this.sectionOptions("summary", {
        cls: "vs-summary-head",
        icon: "sparkles",
        label: "Summary"
      })
    );
    section.body.addClass("vs-summary-body");
    if (data.summary) {
      this.renderMarkdown(section.body, data.summary);
    } else {
      section.details.hidden = true;
    }
    return section;
  }
  renderMarkdown(el, markdown) {
    el.empty();
    void import_obsidian9.MarkdownRenderer.render(this.host.app, markdown, el, this.sourcePath, this);
  }
  buildToolbar(wrap, summaryView) {
    const settings = this.host.settings;
    const agent = currentAgent(settings);
    const bar = wrap.createDiv({ cls: "vs-bar" });
    const modelButton = bar.createEl("button", {
      cls: "vs-model",
      attr: { type: "button", "aria-label": "Model" }
    });
    (0, import_obsidian9.setTooltip)(modelButton, "Model used for summaries");
    const modelText = modelButton.createSpan({
      cls: "vs-model-label",
      text: modelLabel(settings, agent)
    });
    const modelChevron = modelButton.createSpan({ cls: "vs-btn-ico" });
    (0, import_obsidian9.setIcon)(modelChevron, "chevron-down");
    modelButton.addEventListener("click", () => {
      openModelPicker(this.host, agent, () => {
        modelText.setText(modelLabel(settings, agent));
      });
    });
    const summarize = bar.createEl("button", {
      cls: "vs-summarize",
      attr: { type: "button", "aria-label": "Summarize transcript" }
    });
    (0, import_obsidian9.setTooltip)(summarize, "Summarize transcript");
    const summarizeIcon = summarize.createSpan({ cls: "vs-btn-ico" });
    (0, import_obsidian9.setIcon)(summarizeIcon, "sparkles");
    summarize.addEventListener("click", () => {
      void this.summarize(summarize, summarizeIcon, summaryView);
    });
    const cog = bar.createEl("button", {
      cls: "vs-cog",
      attr: { type: "button", "aria-label": "Summary settings" }
    });
    (0, import_obsidian9.setTooltip)(cog, "Summary settings");
    const cogIcon = cog.createSpan({ cls: "vs-btn-ico" });
    (0, import_obsidian9.setIcon)(cogIcon, "cog");
    cog.addEventListener("click", () => {
      new ProsodyModal(this.host.app, this.host, () => this.retranscribe()).open();
    });
  }
  async summarize(button, iconEl, view) {
    const settings = this.host.settings;
    const transcript = this.sidecar?.text ?? "";
    if (!transcript.trim()) {
      new import_obsidian9.Notice("Prosody: nothing to summarize");
      return;
    }
    const agent = currentAgent(settings);
    if (!agent) {
      new import_obsidian9.Notice("Prosody: no agent configured. Open settings.");
      return;
    }
    if (!isRemote(agent) && !import_obsidian9.Platform.isDesktopApp) {
      new import_obsidian9.Notice("Prosody: this agent is desktop-only. Add a ws:// agent for mobile.");
      return;
    }
    button.disabled = true;
    button.addClass("is-busy");
    (0, import_obsidian9.setTooltip)(button, "Summarizing\u2026");
    (0, import_obsidian9.setIcon)(iconEl, "loader-2");
    this.reveal(view);
    view.body.addClass("vs-live");
    view.body.setText("Summarizing\u2026");
    let accumulated = "";
    try {
      const info = await runSummary(agent, settings, this.host.vaultPath(), transcript, (chunk) => {
        accumulated += chunk;
        view.body.setText(accumulated);
        view.body.scrollTop = view.body.scrollHeight;
      });
      if (info.models.length) {
        settings.modelsCache[agent.id] = info;
        await this.host.saveSettings();
      }
      const summary = accumulated.trim();
      view.body.removeClass("vs-live");
      if (summary) {
        await this.persistSummary(summary);
        this.renderMarkdown(view.body, summary);
        new import_obsidian9.Notice("Prosody: summary added");
      } else {
        view.body.setText("");
        new import_obsidian9.Notice("Prosody: the agent returned nothing");
      }
    } catch (err) {
      console.error("prosody: summarize failed", err);
      view.body.removeClass("vs-live");
      if (!this.sidecar?.summary) {
        view.details.hidden = true;
      } else {
        this.renderMarkdown(view.body, this.sidecar.summary);
      }
      new import_obsidian9.Notice(
        "Prosody: summarize failed \u2014 " + (err instanceof Error ? err.message : String(err))
      );
    } finally {
      button.disabled = false;
      button.removeClass("is-busy");
      (0, import_obsidian9.setIcon)(iconEl, "sparkles");
      (0, import_obsidian9.setTooltip)(button, "Summarize transcript");
    }
  }
  reveal(view) {
    view.details.hidden = false;
    view.details.removeClass("vs-reveal");
    void view.details.offsetWidth;
    view.details.addClass("vs-reveal");
  }
  showBusy(text) {
    const status = this.containerEl.createDiv({ cls: "vs-status" });
    const icon = status.createSpan({ cls: "vs-btn-ico vs-spinning" });
    (0, import_obsidian9.setIcon)(icon, "loader-2");
    status.createSpan({ text });
    return status;
  }
  async retranscribe() {
    if (!this.audioFile) return;
    const settings = this.host.settings;
    const status = this.showBusy("Transcribing\u2026");
    try {
      const buffer = await this.host.app.vault.readBinary(this.audioFile);
      const form = new FormData();
      form.append("file", new Blob([buffer]), this.audioFile.name);
      form.append("response_format", "verbose_json");
      form.append("diarize", settings.speakerCount);
      const url = settings.transcriptionUrl.replace(/\/+$/, "") + "/v1/audio/transcriptions";
      const headers = {};
      if (settings.transcriptionToken)
        headers["Authorization"] = "Bearer " + settings.transcriptionToken;
      const response = await fetch(url, { method: "POST", body: form, headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const merged = { ...data, summary: this.sidecar?.summary };
      await this.host.app.vault.adapter.write(this.sidecarPath, JSON.stringify(merged));
      this.sidecar = merged;
      status.remove();
      new import_obsidian9.Notice("Prosody: transcript updated");
      await this.render();
    } catch (err) {
      status.remove();
      new import_obsidian9.Notice(
        "Prosody: re-transcribe failed \u2014 " + (err instanceof Error ? err.message : String(err))
      );
    }
  }
  async persistSummary(summary) {
    const data = { ...this.sidecar, summary };
    this.sidecar = data;
    await this.host.app.vault.adapter.write(this.sidecarPath, JSON.stringify(data));
  }
};

// src/plugin.ts
var ProsodyPlugin = class extends import_obsidian10.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings", DEFAULT_SETTINGS);
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new ProsodySettingsTab(this.app, this));
    for (const fence of FENCES) {
      this.registerMarkdownCodeBlockProcessor(fence, (source, el, ctx) => {
        ctx.addChild(new ProsodyView(el, this, source, ctx.sourcePath));
      });
    }
    this.recommendRecorder();
  }
  recorderEnabled() {
    const internal = this.app.internalPlugins;
    return internal?.getPluginById("audio-recorder")?.enabled ?? true;
  }
  enableRecorder() {
    this.app.internalPlugins?.getPluginById("audio-recorder")?.enable();
  }
  recommendRecorder() {
    if (this.settings.recorderNudgeDismissed || this.recorderEnabled()) return;
    const recorder = this.app.internalPlugins?.getPluginById(
      "audio-recorder"
    );
    const notice = new import_obsidian10.Notice("", 0);
    notice.messageEl.createDiv({
      text: "Prosody needs Obsidian's built-in Audio Recorder to capture voice notes."
    });
    const actions = notice.messageEl.createDiv({ cls: "prosody-notice-actions" });
    const enable = actions.createEl("button", { text: "Enable recorder", cls: "mod-cta" });
    enable.addEventListener("click", () => {
      recorder?.enable();
      notice.hide();
    });
    const later = actions.createEl("button", { text: "Later" });
    later.addEventListener("click", () => {
      this.settings.recorderNudgeDismissed = true;
      void this.saveSettings();
      notice.hide();
    });
  }
  vaultPath() {
    const adapter = this.app.vault.adapter;
    return adapter instanceof import_obsidian10.FileSystemAdapter ? adapter.getBasePath() : "";
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async loadSettings() {
    const stored = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});
    const presetIds = new Set(makePresetAgents().map((agent) => agent.id));
    const storedAgents = this.settings.agents;
    this.settings.agents = storedAgents.map((agent) => {
      const id = agent.id ?? "agent-" + Date.now();
      return {
        id,
        displayName: agent.displayName ?? id,
        command: agent.command ?? "",
        args: agent.args ?? [],
        env: agent.env ?? [],
        enabled: agent.enabled ?? true,
        preset: presetIds.has(id)
      };
    });
    if (this.settings.agents.length === 0) {
      this.settings.agents = makePresetAgents();
    }
    if (!this.settings.agents.some((agent) => agent.id === this.settings.defaultAgentId)) {
      this.settings.defaultAgentId = this.settings.agents[0].id;
    }
  }
};

// src/main.ts
var main_default = ProsodyPlugin;
module.exports = module.exports.default || module.exports;
