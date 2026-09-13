import { PluginSettingTab, Setting, setIcon } from "obsidian";
import type { App, ExtraButtonComponent, Plugin } from "obsidian";
import { DEFAULT_PROMPT, makePresetAgents } from "../constants.js";
import type { Agent, PluginHost } from "../types.js";
import { renderAgentFields } from "./agentFields.js";

type HostPlugin = Plugin & PluginHost;

type Option = [value: string, label: string];

function renderAgentRow(
  container: HTMLElement,
  host: HostPlugin,
  agent: Agent,
  onChanged: () => void,
): void {
  const card = container.createDiv({ cls: "prosody-agent" });

  if (!agent.enabled) card.addClass("is-disabled");

  const header = card.createDiv({ cls: "prosody-agent-header" });
  const chevron = header.createDiv({ cls: "prosody-agent-chevron" });
  setIcon(chevron, "chevron-right");
  header.createDiv({ cls: "prosody-agent-name", text: agent.displayName || agent.id });
  header.createDiv({ cls: "prosody-agent-spacer" });

  const toggle = header.createEl("input", {
    cls: "prosody-agent-toggle",
    attr: { type: "checkbox" },
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
    setIcon(remove, "trash");
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

    if (
      target instanceof HTMLElement &&
      (target.closest("input") ?? target.closest(".prosody-agent-remove"))
    ) {
      return;
    }

    card.toggleClass("is-open", !card.hasClass("is-open"));
  });

  const body = card.createDiv({ cls: "prosody-agent-body" });
  renderAgentFields(body, host, agent, onChanged);
}

export class ProsodySettingsTab extends PluginSettingTab {
  private host: HostPlugin;

  constructor(app: App, host: HostPlugin) {
    super(app, host);
    this.host = host;
  }

  display(): void {
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
        text: "Enable Obsidian's built-in Audio Recorder to record voice notes into your vault; Prosody transcribes them automatically.",
      });
    }

    this.dropdown(
      containerEl,
      "Default agent",
      "Used to summarize transcripts.",
      settings.agents.map((agent): Option => [agent.id, agent.displayName || agent.id]),
      () => settings.defaultAgentId,
      (value) => {
        settings.defaultAgentId = value;
      },
    );
    this.dropdown(
      containerEl,
      "Permissions",
      "Whether agents may use tools while summarizing. Auto-deny is safer.",
      [
        ["deny", "Auto-deny"],
        ["allow", "Auto-allow"],
      ],
      () => settings.permissionMode,
      (value) => {
        settings.permissionMode = value === "allow" ? "allow" : "deny";
      },
    );

    containerEl.createEl("h3", { text: "Windows Subsystem for Linux" });
    this.toggle(
      containerEl,
      "Enable WSL mode",
      "Run agents inside WSL. Recommended for agents that don't work in native Windows.",
      () => settings.windowsWslMode,
      (value) => {
        settings.windowsWslMode = value;
      },
    );
    this.text(
      containerEl,
      "WSL distribution",
      "Specific WSL distribution name (leave empty for default). Example: Ubuntu",
      () => settings.wslDistribution,
      (value) => {
        settings.wslDistribution = value.trim();
      },
      "Leave empty for default",
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

    new Setting(containerEl)
      .setName("New custom agent")
      .setDesc("Register any ACP-compatible agent, command, or ws:// URL.")
      .addButton((button) =>
        button
          .setButtonText("Add custom agent")
          .setCta()
          .onClick(async () => {
            settings.agents.push({
              id: "agent-" + Date.now(),
              displayName: "New agent",
              command: "",
              args: [],
              env: [],
              enabled: true,
              preset: false,
            });
            await this.host.saveSettings();
            rerender();
          }),
      );

    containerEl.createEl("h3", { text: "Advanced" });
    let resetPrompt: ExtraButtonComponent | undefined;
    new Setting(containerEl)
      .setName("Prompt")
      .setDesc("Instructions sent with the transcript.")
      .setClass("prosody-prompt-setting")
      .addTextArea((text) => {
        text.inputEl.rows = 5;
        text.setValue(settings.prompt).onChange(async (value) => {
          settings.prompt = value;
          await this.persist();
          resetPrompt?.setDisabled(value === DEFAULT_PROMPT);
        });
      })
      .addExtraButton((button) => {
        resetPrompt = button;
        button
          .setIcon("rotate-ccw")
          .setTooltip("Reset to default")
          .setDisabled(settings.prompt === DEFAULT_PROMPT)
          .onClick(async () => {
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
      },
    );
    this.toggle(
      containerEl,
      "Debug logging",
      "",
      () => settings.debug,
      (value) => {
        settings.debug = value;
      },
    );

    new Setting(containerEl)
      .setName("Reset preset agents")
      .setDesc("Restore the built-in agent list. Custom agents are kept.")
      .addButton((button) =>
        button.setButtonText("Reset").onClick(async () => {
          const kept = settings.agents.filter((agent) => !agent.preset);

          settings.agents = [...makePresetAgents(), ...kept];
          await this.host.saveSettings();
          rerender();
        }),
      );
  }

  private async persist(): Promise<void> {
    await this.host.saveSettings();
  }

  private toggle(
    container: HTMLElement,
    name: string,
    desc: string,
    get: () => boolean,
    set: (value: boolean) => void,
  ): void {
    new Setting(container)
      .setName(name)
      .setDesc(desc)
      .addToggle((toggle) =>
        toggle.setValue(get()).onChange(async (value) => {
          set(value);
          await this.persist();
        }),
      );
  }

  private text(
    container: HTMLElement,
    name: string,
    desc: string,
    get: () => string,
    set: (value: string) => void,
    placeholder?: string,
  ): void {
    new Setting(container)
      .setName(name)
      .setDesc(desc)
      .addText((text) => {
        if (placeholder) text.setPlaceholder(placeholder);

        text.setValue(get()).onChange(async (value) => {
          set(value);
          await this.persist();
        });
      });
  }

  private dropdown(
    container: HTMLElement,
    name: string,
    desc: string,
    options: Option[],
    get: () => string,
    set: (value: string) => void,
  ): void {
    new Setting(container)
      .setName(name)
      .setDesc(desc)
      .addDropdown((dropdown) => {
        for (const [value, label] of options) dropdown.addOption(value, label);

        dropdown.setValue(get()).onChange(async (value) => {
          set(value);
          await this.persist();
        });
      });
  }
}
