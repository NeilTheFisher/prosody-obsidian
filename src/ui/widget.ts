import {
  MarkdownRenderChild,
  MarkdownRenderer,
  Notice,
  Platform,
  TFile,
  setIcon,
  setTooltip,
} from "obsidian";
import { runSummary } from "../acp/session.js";
import type { PluginHost, Sidecar, Word } from "../types.js";
import { currentAgent, fmtClock, isRemote, modelLabel } from "../util.js";
import { openModelPicker } from "./modelPicker.js";
import { ProsodyModal } from "./modal.js";
import { buildSection, type Section, type SectionOptions } from "./section.js";

export class ProsodyView extends MarkdownRenderChild {
  private host: PluginHost;
  private audioName: string;
  private sourcePath: string;
  private audioFile: TFile | null = null;
  private sidecarPath = "";
  private sidecar: Sidecar | null = null;

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
    this.resetInheritedStyles();
    await this.render();
  }

  private async render(): Promise<void> {
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

  private async readSidecar(): Promise<Sidecar | null> {
    try {
      if (!(await this.host.app.vault.adapter.exists(this.sidecarPath))) return null;

      return JSON.parse(await this.host.app.vault.adapter.read(this.sidecarPath)) as Sidecar;
    } catch (err) {
      console.error("prosody: failed to read sidecar", this.sidecarPath, err);

      return null;
    }
  }

  private renderTranscript(wrap: HTMLElement, data: Sidecar, audio: HTMLAudioElement): void {
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
        meta: meta.join(" · "),
      }),
    );

    this.renderWords(section.body, words, audio);
  }

  private sectionOptions(
    kind: "transcript" | "summary",
    base: Omit<SectionOptions, "open" | "expanded" | "onOpenChange" | "onExpandChange">,
  ): SectionOptions {
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
      },
    };
  }

  private renderWords(text: HTMLElement, words: Word[], audio: HTMLAudioElement): void {
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
  }

  private renderSummary(wrap: HTMLElement, data: Sidecar): Section {
    const section = buildSection(
      wrap,
      this.sectionOptions("summary", {
        cls: "vs-summary-head",
        icon: "sparkles",
        label: "Summary",
      }),
    );

    section.body.addClass("vs-summary-body");

    if (data.summary) {
      this.renderMarkdown(section.body, data.summary);
    } else {
      section.details.hidden = true;
    }

    return section;
  }

  private renderMarkdown(el: HTMLElement, markdown: string): void {
    el.empty();
    void MarkdownRenderer.render(this.host.app, markdown, el, this.sourcePath, this);
  }

  private buildToolbar(wrap: HTMLElement, summaryView: Section): void {
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
      void this.summarize(summarize, summarizeIcon, summaryView);
    });

    const cog = bar.createEl("button", {
      cls: "vs-cog",
      attr: { type: "button", "aria-label": "Summary settings" },
    });

    setTooltip(cog, "Summary settings");
    const cogIcon = cog.createSpan({ cls: "vs-btn-ico" });
    setIcon(cogIcon, "cog");
    cog.addEventListener("click", () => {
      new ProsodyModal(this.host.app, this.host, () => this.retranscribe()).open();
    });
  }

  private async summarize(
    button: HTMLButtonElement,
    iconEl: HTMLElement,
    view: Section,
  ): Promise<void> {
    const settings = this.host.settings;
    const transcript = this.sidecar?.text ?? "";

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
    this.reveal(view);
    view.body.addClass("vs-live");
    view.body.setText("Summarizing…");
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
        new Notice("Prosody: summary added");
      } else {
        view.body.setText("");
        new Notice("Prosody: the agent returned nothing");
      }
    } catch (err) {
      console.error("prosody: summarize failed", err);
      view.body.removeClass("vs-live");

      if (!this.sidecar?.summary) {
        view.details.hidden = true;
      } else {
        this.renderMarkdown(view.body, this.sidecar.summary);
      }

      new Notice(
        "Prosody: summarize failed — " + (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      button.disabled = false;
      button.removeClass("is-busy");
      setIcon(iconEl, "sparkles");
      setTooltip(button, "Summarize transcript");
    }
  }

  private reveal(view: Section): void {
    view.details.hidden = false;
    view.details.removeClass("vs-reveal");
    void view.details.offsetWidth;
    view.details.addClass("vs-reveal");
  }

  private showBusy(text: string): HTMLElement {
    const status = this.containerEl.createDiv({ cls: "vs-status" });
    const icon = status.createSpan({ cls: "vs-btn-ico vs-spinning" });

    setIcon(icon, "loader-2");
    status.createSpan({ text });

    return status;
  }

  private async retranscribe(): Promise<void> {
    if (!this.audioFile) return;

    const settings = this.host.settings;
    const status = this.showBusy("Transcribing…");

    try {
      const buffer = await this.host.app.vault.readBinary(this.audioFile);
      const form = new FormData();

      form.append("file", new Blob([buffer]), this.audioFile.name);
      form.append("response_format", "verbose_json");
      form.append("diarize", settings.speakerCount);

      const url = settings.transcriptionUrl.replace(/\/+$/, "") + "/v1/audio/transcriptions";
      const response = await fetch(url, { method: "POST", body: form });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as Sidecar;
      const merged: Sidecar = { ...data, summary: this.sidecar?.summary };

      await this.host.app.vault.adapter.write(this.sidecarPath, JSON.stringify(merged));
      this.sidecar = merged;
      status.remove();
      new Notice("Prosody: transcript updated");
      await this.render();
    } catch (err) {
      status.remove();
      new Notice(
        "Prosody: re-transcribe failed — " + (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  private async persistSummary(summary: string): Promise<void> {
    const data: Sidecar = { ...this.sidecar, summary };

    this.sidecar = data;
    await this.host.app.vault.adapter.write(this.sidecarPath, JSON.stringify(data));
  }
}
