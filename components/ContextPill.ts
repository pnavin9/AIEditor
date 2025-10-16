import type { TextContext } from './LeftPanel';

/** Lightweight UI component to show currently selected context as a pill above the input. */
export class ContextPill {
  private parentPanel: HTMLElement | null;
  private beforeNode: Element | null;
  private wrapperEl: HTMLElement | null = null;
  private pillEl: HTMLElement | null = null;
  private textEl: HTMLElement | null = null;
  private tooltipEl: HTMLElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;
  private ignore: boolean = false;
  private lastSelectionFingerprint: string = '';

  constructor(parentPanelId: string, beforeSelector: string) {
    this.parentPanel = document.getElementById(parentPanelId);
    this.beforeNode = document.querySelector(beforeSelector);
    this.mount();
  }

  private mount() {
    if (!this.parentPanel || !this.beforeNode) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'context-pill-wrapper';
    const pill = document.createElement('div');
    pill.className = 'context-pill';
    pill.style.display = 'none';

    const textEl = document.createElement('div');
    textEl.className = 'context-pill-text';

    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'context-pill-tooltip';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'context-pill-close';
    closeBtn.setAttribute('title', 'Clear context');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.clearAndIgnore();
    });

    pill.appendChild(textEl);
    pill.appendChild(closeBtn);
    pill.appendChild(tooltipEl);
    wrapper.appendChild(pill);

    this.parentPanel.insertBefore(wrapper, this.beforeNode);

    this.wrapperEl = wrapper;
    this.pillEl = pill;
    this.textEl = textEl;
    this.tooltipEl = tooltipEl;
    this.closeBtn = closeBtn;
  }

  isIgnoring(): boolean {
    return this.ignore;
  }

  resetIgnore() {
    this.ignore = false;
  }

  clearAndIgnore() {
    this.ignore = true;
    this.hide();
  }

  hide() {
    if (this.pillEl) this.pillEl.style.display = 'none';
  }

  show(preview: string, tooltip: string) {
    if (!this.pillEl || !this.textEl || !this.tooltipEl) return;
    this.textEl.textContent = preview;
    this.tooltipEl.textContent = tooltip;
    this.pillEl.style.display = 'flex';
  }

  /** Update pill content from providers. Resets ignore if a new selection appears. */
  updateFromSelection(
    getSelectedText?: () => string,
    getTextContext?: (text: string) => TextContext
  ) {
    if (!getSelectedText) return;
    const sel = (getSelectedText() || '').trim();
    if (!sel) {
      this.hide();
      return;
    }

    // If selection changed, stop ignoring
    const fp = sel.slice(0, 120);
    if (this.lastSelectionFingerprint !== fp) {
      this.ignore = false;
      this.lastSelectionFingerprint = fp;
    }

    if (this.ignore) {
      this.hide();
      return;
    }

    const preview = sel.replace(/\s+/g, ' ').slice(0, 80) + (sel.length > 80 ? '…' : '');
    let tooltip = sel;
    try {
      if (getTextContext) {
        const ctx = getTextContext(sel);
        if (ctx && ctx.fullContext) {
          tooltip = ctx.fullContext.slice(0, 600) + (ctx.fullContext.length > 600 ? '…' : '');
        }
      }
    } catch {}
    this.show(preview, tooltip);
  }
}


