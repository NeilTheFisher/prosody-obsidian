import { FuzzySuggestModal } from "obsidian";
import type { App } from "obsidian";
import type { Agent, PluginHost } from "../types.js";
import { modelState, setModelValue } from "../util.js";

interface ModelChoice {
  label: string;
  value: string;
}

class ModelPickerModal extends FuzzySuggestModal<ModelChoice> {
  private choices: ModelChoice[];
  private choose: (value: string) => void | Promise<void>;

  constructor(app: App, choices: ModelChoice[], choose: (value: string) => void | Promise<void>) {
    super(app);
    this.choices = choices;
    this.choose = choose;
    this.setPlaceholder("Search models…");
  }

  getItems(): ModelChoice[] {
    return this.choices;
  }

  getItemText(item: ModelChoice): string {
    return item.label;
  }

  onChooseItem(item: ModelChoice): void {
    void this.choose(item.value);
  }
}

/** Open the searchable model picker for an agent and persist the choice. */
export function openModelPicker(host: PluginHost, agent: Agent | null, onPicked: () => void): void {
  const state = modelState(host.settings, agent);
  const choices: ModelChoice[] = [{ label: "Default model", value: "" }];

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
