import { PluginSettingTab, Setting, setIcon } from "obsidian";
import type { App, Plugin } from "obsidian";
import { makePresetAgents } from "../constants.js";
import type { Agent, PluginHost } from "../types.js";
import { renderAgentFields } from "./agentFields.js";

type HostPlugin = Plugin & PluginHost;

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

    new Setting(containerEl)
      .setName("Default agent")
      .setDesc("Used to summarize transcripts.")
      .addDropdown((dropdown) => {
        for (const agent of settings.agents)
          dropdown.addOption(agent.id, agent.displayName || agent.id);
        dropdown.setValue(settings.defaultAgentId).onChange(async (value) => {
          settings.defaultAgentId = value;
          await this.host.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Permissions")
      .setDesc("Whether agents may use tools while summarizing. Auto-deny is safer.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("deny", "Auto-deny")
          .addOption("allow", "Auto-allow")
          .setValue(settings.permissionMode)
          .onChange(async (value) => {
            settings.permissionMode = value === "allow" ? "allow" : "deny";
            await this.host.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: "Windows Subsystem for Linux" });
    new Setting(containerEl)
      .setName("Enable WSL mode")
      .setDesc("Run agents inside WSL. Recommended for agents that don't work in native Windows.")
      .addToggle((toggle) =>
        toggle.setValue(settings.windowsWslMode).onChange(async (value) => {
          settings.windowsWslMode = value;
          await this.host.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName("WSL distribution")
      .setDesc("Specific WSL distribution name (leave empty for default). Example: Ubuntu")
      .addText((text) =>
        text
          .setPlaceholder("Leave empty for default")
          .setValue(settings.wslDistribution)
          .onChange(async (value) => {
            settings.wslDistribution = value.trim();
            await this.host.saveSettings();
          }),
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
    new Setting(containerEl)
      .setName("Prompt")
      .setDesc("Instructions sent with the transcript.")
      .addTextArea((text) => {
        text.inputEl.rows = 5;
        text.setValue(settings.prompt).onChange(async (value) => {
          settings.prompt = value;
          await this.host.saveSettings();
        });
      });
    new Setting(containerEl)
      .setName("Working directory")
      .setDesc("Empty = vault root. For WSL agents this is passed as --cd.")
      .addText((text) =>
        text.setValue(settings.cwd).onChange(async (value) => {
          settings.cwd = value.trim();
          await this.host.saveSettings();
        }),
      );
    new Setting(containerEl).setName("Debug logging").addToggle((toggle) =>
      toggle.setValue(settings.debug).onChange(async (value) => {
        settings.debug = value;
        await this.host.saveSettings();
      }),
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
}
