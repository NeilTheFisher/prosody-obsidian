import { setIcon, setTooltip } from "obsidian";

export interface SectionOptions {
  cls: string;
  icon: string;
  label: string;
  meta?: string;
  open: boolean;
  expanded: boolean;
  onOpenChange: (open: boolean) => void;
  onExpandChange: (expanded: boolean) => void;
}

export interface Section {
  details: HTMLDetailsElement;
  body: HTMLElement;
  scroller: HTMLElement;
  expand: HTMLButtonElement;
}

/** A collapsible, height-clamped section with an expand/collapse toggle in its header. */
export function buildSection(wrap: HTMLElement, options: SectionOptions): Section {
  const details = wrap.createEl("details", { cls: "vs-head " + options.cls });

  details.open = options.open;
  details.toggleClass("is-expanded", options.expanded);

  const head = details.createEl("summary", { cls: "vs-summary" });
  const chevron = head.createSpan({ cls: "vs-chevron" });
  setIcon(chevron, "chevron-right");
  const icon = head.createSpan({ cls: "vs-ico" });
  setIcon(icon, options.icon);
  head.createSpan({ cls: "vs-label", text: options.label });

  if (options.meta) head.createSpan({ cls: "vs-meta", text: options.meta });

  const expand = head.createEl("button", {
    cls: "vs-expand",
    attr: { type: "button", "aria-label": "Toggle section height" },
  });

  const expandIcon = expand.createSpan({ cls: "vs-btn-ico" });

  const refreshExpand = () => {
    const isExpanded = details.hasClass("is-expanded");

    setIcon(expandIcon, isExpanded ? "chevrons-up" : "chevrons-down");
    setTooltip(expand, isExpanded ? "Collapse height" : "Expand height");
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
