import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";
import { fetchModels } from "../acp/session.js";
import type { PluginHost } from "../types.js";
import { currentAgent, modelLabel, modelState } from "../util.js";
import { openModelPicker } from "./modelPicker.js";

interface AppWithSetting extends App {
  setting: { open(): void; openTabById(id: string): void };
}

export class ProsodyModal extends Modal {
  private host: PluginHost;
  private onChanged?: () => void;

  constructor(app: App, host: PluginHost, onChanged?: () => void) {
    super(app);
    this.host = host;
    this.onChanged = onChanged;
  }

  private notifyChanged(): void {
    if (this.onChanged) this.onChanged();
  }

  onOpen(): void {
    const settings = this.host.settings;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Prosody" });

    const agents = settings.agents.filter((candidate) => candidate.enabled);
    const agent = currentAgent(settings);

    const rerender = () => {
      this.onOpen();
      this.notifyChanged();
    };

    new Setting(contentEl).setName("Agent").addDropdown((dropdown) => {
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

    const modelSetting = new Setting(contentEl)
      .setName("Model")
      .setDesc(options.length > 0 ? "" : "Refresh to load models from the agent.");

    modelSetting.addButton((button) =>
      button.setButtonText(modelLabel(settings, agent)).onClick(() => {
        openModelPicker(this.host, agent, rerender);
      }),
    );

    modelSetting.addExtraButton((button) =>
      button
        .setIcon("refresh-cw")
        .setTooltip("Refresh models from the agent")
        .onClick(async () => {
          if (!agent) return;

          button.setDisabled(true);

          try {
            const result = await fetchModels(agent, settings, this.host.vaultPath());
            settings.modelsCache[agent.id] = result;
            await this.host.saveSettings();
            new Notice(`Prosody: loaded ${result.models.length} models`);
          } catch (err) {
            new Notice("Prosody: " + (err instanceof Error ? err.message : String(err)));
          } finally {
            button.setDisabled(false);
            rerender();
          }
        }),
    );

    new Setting(contentEl)
      .setName("Permissions")
      .setDesc("Tool requests during summarization")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("deny", "Auto-deny")
          .addOption("allow", "Auto-allow")
          .setValue(settings.permissionMode)
          .onChange(async (value) => {
            settings.permissionMode = value === "allow" ? "allow" : "deny";
            await this.host.saveSettings();
            this.notifyChanged();
          }),
      );

    new Setting(contentEl).addButton((button) =>
      button.setButtonText("Open full settings").onClick(() => {
        this.close();
        const app = this.app as AppWithSetting;
        app.setting.open();
        app.setting.openTabById(this.host.manifest.id);
      }),
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
