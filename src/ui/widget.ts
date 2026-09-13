import { MarkdownRenderChild, Notice, Platform, TFile, setIcon, setTooltip } from "obsidian";
import { runSummary } from "../acp/session.js";
import { FENCES, SUMMARY_END, SUMMARY_START } from "../constants.js";
import type { PluginHost, Sidecar } from "../types.js";
import { currentAgent, fmtClock, isRemote, modelLabel } from "../util.js";
import { openModelPicker } from "./modelPicker.js";
import { ProsodyModal } from "./modal.js";

export class ProsodyView extends MarkdownRenderChild {
  private host: PluginHost;
  private audioName: string;
  private sourcePath: string;

  constructor(el: HTMLElement, host: PluginHost, source: string, sourcePath: string) {
    super(el);
    this.host = host;
    this.audioName = (source.trim().split("\n")[0] ?? "").trim();
    this.sourcePath = sourcePath;
  }

  private resetInheritedStyles(): void {
    let node: HTMLElement = this.containerEl;

    for (let depth = 0; depth < 3; depth++) {
      node.style.whiteSpace = "normal";
      node.style.overflow = "visible";
      node.style.background = "none";
      node.style.border = "none";
      node.style.padding = "0";
      node.style.margin = "0";
      const parent: HTMLElement | null = node.parentElement;

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

  private state(wrap: HTMLElement, icon: string, text: string, isError = false): void {
    const el = wrap.createDiv({ cls: "vs-state" + (isError ? " vs-error" : "") });
    const iconEl = el.createSpan({ cls: "vs-state-ico" });
    setIcon(iconEl, icon);
    el.createSpan({ text });
  }

  async onload(): Promise<void> {
    this.containerEl.addClass("prosody-root");
    this.containerEl.empty();
    this.resetInheritedStyles();

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

    const audio = wrap.createEl("audio", { attr: { controls: "", preload: "metadata" } });
    audio.src = this.host.app.vault.adapter.getResourcePath(file.path);

    const data = await this.readSidecar(file);

    if (!data?.words?.length) {
      this.state(wrap, "hourglass", "Transcript is on its way once the local service finishes.");

      return;
    }

    const statusEl = this.renderTranscript(wrap, data, audio);
    this.buildToolbar(wrap, data, statusEl);
  }

  private async readSidecar(file: TFile): Promise<Sidecar | null> {
    const sidecarPath = file.path.replace(/\.[^.]+$/, ".json");

    try {
      if (!(await this.host.app.vault.adapter.exists(sidecarPath))) return null;

      return JSON.parse(await this.host.app.vault.adapter.read(sidecarPath)) as Sidecar;
    } catch (err) {
      console.error("prosody: failed to read sidecar", sidecarPath, err);

      return null;
    }
  }

  private renderTranscript(wrap: HTMLElement, data: Sidecar, audio: HTMLAudioElement): HTMLElement {
    const words = data.words ?? [];
    const lastSegment = data.segments?.at(-1);
    const meta = [`${words.length.toLocaleString()} words`];

    if (lastSegment) meta.push(fmtClock(lastSegment.end));

    const details = wrap.createEl("details", { cls: "vs-head" });
    const summary = details.createEl("summary", { cls: "vs-summary" });
    const chevron = summary.createSpan({ cls: "vs-chevron" });
    setIcon(chevron, "chevron-right");
    const icon = summary.createSpan({ cls: "vs-ico" });
    setIcon(icon, "audio-lines");
    summary.createSpan({ cls: "vs-label", text: "Transcript" });
    summary.createSpan({ cls: "vs-meta", text: meta.join(" · ") });

    const body = details.createDiv({ cls: "vs-body" });
    const text = body.createDiv({ cls: "vs-text" });

    const hasSpeakers = words.some((word) => typeof word.speaker === "number");
    const spans: HTMLElement[] = [];
    let container: HTMLElement = text;
    let speaker: number | null = null;

    for (const word of words) {
      const wordSpeaker = typeof word.speaker === "number" ? word.speaker : null;

      if (hasSpeakers && wordSpeaker !== speaker) {
        speaker = wordSpeaker;
        const utterance = text.createDiv({ cls: "vs-utterance" });
        utterance.createDiv({
          cls: "vs-speaker",
          text: `Speaker ${speaker === null ? "?" : speaker + 1}`,
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

    const highlight = (index: number) => {
      if (index === active) return;

      if (active >= 0) spans[active].removeClass("vs-active");
      active = index;
      const span = index >= 0 ? spans[index] : undefined;

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

    return text;
  }

  private buildToolbar(wrap: HTMLElement, data: Sidecar, statusEl: HTMLElement): void {
    const settings = this.host.settings;
    const agent = currentAgent(settings);

    const bar = wrap.createDiv({ cls: "vs-bar" });

    const modelButton = bar.createEl("button", {
      cls: "vs-model",
      attr: { type: "button", "aria-label": "Model" },
    });

    setTooltip(modelButton, "Model used for summaries");

    const modelText = modelButton.createSpan({
      cls: "vs-model-label",
      text: modelLabel(settings, agent),
    });

    const modelChevron = modelButton.createSpan({ cls: "vs-btn-ico" });
    setIcon(modelChevron, "chevron-down");
    modelButton.addEventListener("click", () => {
      openModelPicker(this.host, agent, () => {
        modelText.setText(modelLabel(settings, agent));
      });
    });

    const summarize = bar.createEl("button", {
      cls: "vs-summarize",
      attr: { type: "button", "aria-label": "Summarize transcript" },
    });

    setTooltip(summarize, "Summarize transcript");
    const summarizeIcon = summarize.createSpan({ cls: "vs-btn-ico" });
    setIcon(summarizeIcon, "sparkles");
    summarize.addEventListener("click", () => {
      void this.summarize(summarize, summarizeIcon, data.text ?? "", statusEl);
    });

    const cog = bar.createEl("button", {
      cls: "vs-cog",
      attr: { type: "button", "aria-label": "Summary settings" },
    });

    setTooltip(cog, "Summary settings");
    const cogIcon = cog.createSpan({ cls: "vs-btn-ico" });
    setIcon(cogIcon, "cog");
    cog.addEventListener("click", () => {
      new ProsodyModal(this.host.app, this.host).open();
    });
  }

  private async summarize(
    button: HTMLButtonElement,
    iconEl: HTMLElement,
    transcript: string,
    statusEl: HTMLElement,
  ): Promise<void> {
    const settings = this.host.settings;

    if (!transcript.trim()) {
      new Notice("Prosody: nothing to summarize");

      return;
    }

    const agent = currentAgent(settings);

    if (!agent) {
      new Notice("Prosody: no agent configured. Open settings.");

      return;
    }

    if (!isRemote(agent) && !Platform.isDesktopApp) {
      new Notice("Prosody: this agent is desktop-only. Add a ws:// agent for mobile.");

      return;
    }

    button.disabled = true;
    button.addClass("is-busy");
    setTooltip(button, "Summarizing…");
    setIcon(iconEl, "loader-2");
    statusEl.setText("");
    statusEl.addClass("vs-live");
    let accumulated = "";

    try {
      const info = await runSummary(agent, settings, this.host.vaultPath(), transcript, (chunk) => {
        accumulated += chunk;
        statusEl.setText(accumulated);
        statusEl.scrollTop = statusEl.scrollHeight;
      });

      if (info.models.length) {
        settings.modelsCache[agent.id] = info;
        await this.host.saveSettings();
      }

      const summary = accumulated.trim();

      if (summary) {
        await this.insertSummary(summary);
        new Notice("Prosody: summary added");
      } else {
        new Notice("Prosody: the agent returned nothing");
      }
    } catch (err) {
      console.error("prosody: summarize failed", err);
      new Notice(
        "Prosody: summarize failed — " + (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      button.disabled = false;
      button.removeClass("is-busy");
      setIcon(iconEl, "sparkles");
      setTooltip(button, "Summarize transcript");
      statusEl.removeClass("vs-live");
      statusEl.setText("");
    }
  }

  private async insertSummary(summary: string): Promise<void> {
    const file = this.host.app.vault.getAbstractFileByPath(this.sourcePath);

    if (!(file instanceof TFile)) return;

    const callout =
      "> [!summary]- Summary\n" +
      summary
        .split("\n")
        .map((line) => (line ? "> " + line : ">"))
        .join("\n");

    const block = `${SUMMARY_START}\n${callout}\n${SUMMARY_END}`;
    const content = await this.host.app.vault.read(file);
    const marker = new RegExp(SUMMARY_START + "[\\s\\S]*?" + SUMMARY_END);
    let updated: string;

    if (marker.test(content)) {
      updated = content.replace(marker, block);
    } else {
      const anchor = this.findFenceAnchor(content);

      if (anchor === -1) {
        updated = content.replace(/\s*$/, "") + "\n\n" + block + "\n";
      } else {
        const close = content.indexOf("\n```", anchor);
        const insertAt = close === -1 ? content.length : close + 4;
        updated =
          content.slice(0, insertAt) +
          "\n\n" +
          block +
          "\n" +
          content.slice(insertAt).replace(/^\n+/, "");
      }
    }

    await this.host.app.vault.modify(file, updated);
  }

  private findFenceAnchor(content: string): number {
    for (const fence of FENCES) {
      const at = content.indexOf("```" + fence + "\n" + this.audioName);

      if (at !== -1) return at;
    }

    return -1;
  }
}
