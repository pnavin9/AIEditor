/** Text and contextual information around a selection. */
export interface TextContext {
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  fullContext: string;
}

/** Payload for showing change preview with accept/reject callbacks. */
export interface ChangePreview {
  oldText: string;
  newText: string;
  onAccept: () => void;
  onReject: () => void;
}

/** Lightweight document section for outline/context without sending full file. */
export interface DocumentSection {
  title: string;
  startLine: number;
  textPreview: string; // small snippet to keep context light
}

/**
 * Renders the source document and provides selection + preview capabilities.
 */
export class LeftPanel {
  private container: HTMLElement;
  private text: string = '';
  private lastSelectedText: string = '';
  private lastSelectedRawText: string = '';
  private previewOverlay: HTMLElement | null = null;

  constructor(containerId: string) {
    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`Element with id ${containerId} not found`);
    }
    this.container = element;
    this.setupSelectionTracking();
  }

  /**
   * Returns a compact outline of the document by detecting headers and
   * generating small previews per section. Keeps previews short to
   * stay under model context limits.
   */
  getDocumentOutline(maxPreviewChars: number = 400): DocumentSection[] {
    const lines = this.text.split('\n');
    const sections: { index: number; title: string }[] = [];
    const headerRegex = /^(\\section\*?\{|\\chapter\*?\{|#{1,6}\s)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (headerRegex.test(line)) {
        // Extract a readable title
        let title = line
          .replace(/^#+\s*/, '')
          .replace(/\\section\*?\{([^}]*)\}.*/, '$1')
          .replace(/\\chapter\*?\{([^}]*)\}.*/, '$1')
          .trim();
        if (!title) title = line.trim().slice(0, 80);
        sections.push({ index: i, title });
      }
    }

    const results: DocumentSection[] = [];
    for (let s = 0; s < sections.length; s++) {
      const start = sections[s].index;
      const end = s + 1 < sections.length ? sections[s + 1].index : lines.length;
      const slice = lines.slice(start, end).join('\n');
      const preview = slice.slice(0, maxPreviewChars);
      results.push({ title: sections[s].title, startLine: start, textPreview: preview });
    }
    return results;
  }

  private setupSelectionTracking() {
    document.addEventListener('selectionchange', () => {
      const selection = window.getSelection();
      if (selection && selection.toString() && this.container.contains(selection.anchorNode)) {
        const selectedRendered = selection.toString().trim();
        this.lastSelectedText = selectedRendered;
        // Find corresponding raw text
        this.lastSelectedRawText = this.findRawTextForSelection(selectedRendered);

      }
    });
  }


  private findRawTextForSelection(renderedText: string): string {
    // Try to find the rendered text in the raw source
    // This handles cases where formatting is stripped during rendering
    
    // First, try exact match
    if (this.text.includes(renderedText)) {
      console.log('✓ Found exact match in raw text');
      return renderedText;
    }

    // Try to find by looking for the text content within LaTeX/Markdown formatting
    const lines = this.text.split('\n');
    const renderedLines = renderedText.split('\n');
    
    // Look for matching lines in raw text
    const matchingRawLines: string[] = [];
    let foundStart = false;
    
    for (let i = 0; i < lines.length; i++) {
      // Remove common formatting to compare
      const cleanLine = this.stripFormatting(lines[i]);
      
      if (!foundStart && cleanLine.includes(this.stripFormatting(renderedLines[0]))) {
        foundStart = true;
        matchingRawLines.push(lines[i]);
        
        // If single line selection, return immediately
        if (renderedLines.length === 1) {
          console.log('Found raw text with formatting:', lines[i]);
          return lines[i];
        }
      } else if (foundStart) {
        matchingRawLines.push(lines[i]);
        
        // Check if we've found all lines
        if (matchingRawLines.length >= renderedLines.length) {
          break;
        }
      }
    }
    
    if (matchingRawLines.length > 0) {
      const rawText = matchingRawLines.join('\n');
      console.log(`Found ${matchingRawLines.length} lines of raw text with formatting`);
      return rawText;
    }
    
    // Fallback to rendered text if no match found
    console.warn('Could not find raw text for selection, ' +
      'using rendered text (may cause update failures)');
    return renderedText;
  }

  private stripFormatting(text: string): string {
    return text
      .replace(/\\section\*\{/g, '')
      .replace(/\}/g, '')
      .replace(/^#+\s*/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .trim();
  }

  getSelectedText(): string {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      const rendered = selection.toString().trim();
      return this.findRawTextForSelection(rendered);
    }
    return this.lastSelectedRawText || this.lastSelectedText;
  }

  getLastSelectedText(): string {
    return this.lastSelectedRawText || this.lastSelectedText;
  }

  getTextWithContext(selectedText: string, _contextLines: number = 5): TextContext {
    const lines = this.text.split('\n');
    const selectedLines = selectedText.split('\n');
    
    // Find the starting line index of the selected text
    let startLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      let match = true;
      for (let j = 0; j < selectedLines.length; j++) {
        if (i + j >= lines.length || lines[i + j] !== selectedLines[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        startLineIndex = i;
        break;
      }
    }

    // If exact match not found, try to find by first line
    if (startLineIndex === -1) {
      startLineIndex = lines.findIndex(line => line.includes(selectedLines[0]));
    }

    if (startLineIndex === -1) {
      // Fallback: return selected text only
      return {
        selectedText,
        contextBefore: '',
        contextAfter: '',
        fullContext: selectedText
      };
    }

    const endLineIndex = startLineIndex + selectedLines.length;

    // Determine enclosing section boundaries
    const isSectionHeader = (line: string): boolean => {
      return /^(\\section\*\{)/.test(line) || /^#{1,6}\s/.test(line) || /^##\s/.test(line) || /^(\\chapter\*?\{)/.test(line);
    };

    // Find section start: nearest header at or before startLineIndex
    let sectionStart = 0;
    for (let i = startLineIndex; i >= 0; i--) {
      if (isSectionHeader(lines[i])) {
        sectionStart = i;
        break;
      }
    }

    // Find section end: next header after endLineIndex (exclusive)
    let sectionEnd = lines.length;
    for (let i = endLineIndex; i < lines.length; i++) {
      if (isSectionHeader(lines[i])) {
        sectionEnd = i; // stop before next header
        break;
      }
    }

    const sectionText = lines.slice(sectionStart, sectionEnd).join('\n');

    // Send the entire section with no extra context, to preserve formatting
    return {
      selectedText: sectionText,
      contextBefore: '',
      contextAfter: '',
      fullContext: sectionText
    };
  }

  loadContent(content: string) {
    this.text = content;
    this.render();
  }

  private render() {
    if (typeof (window as any).render === 'function') {
      const options = {
        htmlTags: true
      };
      const html = (window as any).render(this.text, options);
      this.container.innerHTML = html;
    } else {
      console.warn('Render function not available yet');
    }
  }

  showChangePreview(preview: ChangePreview) {
    // Remove existing preview if any
    this.hideChangePreview();

    // Create overlay
    this.previewOverlay = document.createElement('div');
    this.previewOverlay.className = 'preview-overlay';
    
    const previewContent = document.createElement('div');
    previewContent.className = 'preview-panel';
    const normalizeForPreview = (s: string) => s
      .replace(/\\n/g, '\n')
      .replace(/[\t ]*\\\n/g, '\n')
      .replace(/^\s*\\\s*$/gm, '')
      .replace(/^\s*•\s?/gm, '- ');
    const normalizedOld = normalizeForPreview(preview.oldText);
    const normalizedNew = normalizeForPreview(preview.newText);
    previewContent.innerHTML = `
      <div class="preview-panel-header">
        <h3>📝 Preview Changes</h3>
      </div>
      <div class="preview-panel-content">
        <div class="preview-comparison">
          <div class="preview-side">
            <div class="preview-side-label">Current Text</div>
            <div class="preview-side-content old-content">${this.escapeHtml(normalizedOld)}</div>
          </div>
          <div class="preview-divider">→</div>
          <div class="preview-side">
            <div class="preview-side-label">Proposed Text</div>
            <div class="preview-side-content new-content">${this.escapeHtml(normalizedNew)}</div>
          </div>
        </div>
        <div class="preview-panel-actions">
          <button class="preview-panel-btn accept-btn">✓ Accept Changes</button>
          <button class="preview-panel-btn reject-btn">✗ Reject Changes</button>
        </div>
      </div>
    `;

    this.previewOverlay.appendChild(previewContent);
    this.container.appendChild(this.previewOverlay);

    // Add event listeners
    const acceptBtn = previewContent.querySelector('.accept-btn');
    const rejectBtn = previewContent.querySelector('.reject-btn');

    acceptBtn?.addEventListener('click', () => {
      preview.onAccept();
      this.hideChangePreview();
    });

    rejectBtn?.addEventListener('click', () => {
      preview.onReject();
      this.hideChangePreview();
    });
  }

  hideChangePreview() {
    if (this.previewOverlay) {
      this.previewOverlay.remove();
      this.previewOverlay = null;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

