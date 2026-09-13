import { FileSystemAdapter, Notice, Plugin } from "obsidian";
import type { App } from "obsidian";
import { DEFAULT_SETTINGS, FENCES, makePresetAgents } from "./constants.js";
import type { Agent, PluginHost, ProsodySettings } from "./types.js";
import { ProsodySettingsTab } from "./ui/settingsTab.js";
import { ProsodyView } from "./ui/widget.js";

interface InternalPluginLike {
  enabled: boolean;
  enable(): void;
}

interface AppWithInternalPlugins extends App {
  internalPlugins?: { getPluginById(id: string): InternalPluginLike | undefined };
}

export class ProsodyPlugin extends Plugin implements PluginHost {
  settings: ProsodySettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new ProsodySettingsTab(this.app, this));

    for (const fence of FENCES) {
      this.registerMarkdownCodeBlockProcessor(fence, (source, el, ctx) => {
        ctx.addChild(new ProsodyView(el, this, source, ctx.sourcePath));
      });
    }

    this.recommendRecorder();
  }

  recorderEnabled(): boolean {
    const internal = (this.app as AppWithInternalPlugins).internalPlugins;

    return internal?.getPluginById("audio-recorder")?.enabled ?? true;
  }

  enableRecorder(): void {
    (this.app as AppWithInternalPlugins).internalPlugins?.getPluginById("audio-recorder")?.enable();
  }

  private recommendRecorder(): void {
    if (this.settings.recorderNudgeDismissed || this.recorderEnabled()) return;

    const recorder = (this.app as AppWithInternalPlugins).internalPlugins?.getPluginById(
      "audio-recorder",
    );

    const notice = new Notice("", 0);
    notice.messageEl.createDiv({
      text: "Prosody needs Obsidian's built-in Audio Recorder to capture voice notes.",
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

  vaultPath(): string {
    const adapter = this.app.vault.adapter;

    return adapter instanceof FileSystemAdapter ? adapter.getBasePath() : "";
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<ProsodySettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});

    const presetIds = new Set(makePresetAgents().map((agent) => agent.id));
    const storedAgents = this.settings.agents as Array<Partial<Agent>>;
    this.settings.agents = storedAgents.map((agent) => {
      const id = agent.id ?? "agent-" + Date.now();

      return {
        id,
        displayName: agent.displayName ?? id,
        command: agent.command ?? "",
        args: agent.args ?? [],
        env: agent.env ?? [],
        enabled: agent.enabled ?? true,
        preset: presetIds.has(id),
      };
    });

    if (this.settings.agents.length === 0) {
      this.settings.agents = makePresetAgents();
    }

    if (!this.settings.agents.some((agent) => agent.id === this.settings.defaultAgentId)) {
      this.settings.defaultAgentId = this.settings.agents[0].id;
    }
  }
}
