import { FileUpdateService } from '../services/fileUpdate';

interface HistoryEntry {
  oldText: string;
  newText: string;
  timestamp: number;
}

/**
 * Manages undo/redo operations by reapplying file updates via the API.
 */
export class UndoRedoButtons {
  private undoButton: HTMLButtonElement | null;
  private redoButton: HTMLButtonElement | null;
  private fileUpdateService: FileUpdateService;
  private history: HistoryEntry[] = [];
  private currentIndex: number = -1;
  private readonly MAX_HISTORY_SIZE = 50; // Limit history to prevent memory issues
  private readonly MAX_TEXT_SIZE = 50000; // Only store changes smaller than ~50KB

  constructor(undoButtonId: string, redoButtonId: string) {
    this.undoButton = document.getElementById(undoButtonId) as HTMLButtonElement;
    if (!this.undoButton) {
      throw new Error(`Undo button with id ${undoButtonId} not found`);
    }

    this.redoButton = document.getElementById(redoButtonId) as HTMLButtonElement;
    if (!this.redoButton) {
      throw new Error(`Redo button with id ${redoButtonId} not found`);
    }

    this.fileUpdateService = new FileUpdateService();
    this.setupEventListeners();
    this.updateButtonStates();
  }

  private setupEventListeners() {
    this.undoButton?.addEventListener('click', () => this.undo());
    this.redoButton?.addEventListener('click', () => this.redo());
  }

  private updateButtonStates() {
    if (this.undoButton) {
      this.undoButton.disabled = this.currentIndex < 0;
      this.undoButton.title = this.canUndo() ? 'Undo last change' : 'Nothing to undo';
    }
    if (this.redoButton) {
      this.redoButton.disabled = this.currentIndex >= this.history.length - 1;
      this.redoButton.title = this.canRedo() ? 'Redo change' : 'Nothing to redo';
    }
  }

  addToHistory(oldText: string, newText: string) {
    // Check if change is too large to store efficiently
    const totalSize = oldText.length + newText.length;
    if (totalSize > this.MAX_TEXT_SIZE) {
      console.warn(`Change too large (${totalSize} chars) to store in undo history. Limit: ${this.MAX_TEXT_SIZE}`);
      return;
    }

    // Remove any history after current index (when user makes new change after undo)
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // If history is at max size, remove oldest entry
    if (this.history.length >= this.MAX_HISTORY_SIZE) {
      this.history.shift();
      this.currentIndex--;
      console.log('History limit reached. Removed oldest entry.');
    }

    this.history.push({
      oldText,
      newText,
      timestamp: Date.now()
    });

    this.currentIndex = this.history.length - 1;
    this.updateButtonStates();
    
    const sizeKB = (totalSize / 1024).toFixed(2);
    console.log(`History updated. Total entries: ${this.history.length}, Current index: ${this.currentIndex}, Size: ${sizeKB}KB`);
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  async undo(): Promise<boolean> {
    if (!this.canUndo()) {
      console.log('Cannot undo: at beginning of history');
      return false;
    }

    const entry = this.history[this.currentIndex];
    console.log('Undoing change:', entry);

    try {
      // Revert to old text
      const success = await this.fileUpdateService.updateManual(entry.newText, entry.oldText);
      
      if (success) {
        this.currentIndex--;
        this.updateButtonStates();
        console.log('Undo successful. New index:', this.currentIndex);
        return true;
      } else {
        console.error('Failed to undo change');
        return false;
      }
    } catch (error) {
      console.error('Error during undo:', error);
      return false;
    }
  }

  async redo(): Promise<boolean> {
    if (!this.canRedo()) {
      console.log('Cannot redo: at end of history');
      return false;
    }

    const nextIndex = this.currentIndex + 1;
    const entry = this.history[nextIndex];
    console.log('Redoing change:', entry);

    try {
      // Reapply new text
      const success = await this.fileUpdateService.updateManual(entry.oldText, entry.newText);
      
      if (success) {
        this.currentIndex++;
        this.updateButtonStates();
        console.log('Redo successful. New index:', this.currentIndex);
        return true;
      } else {
        console.error('Failed to redo change');
        return false;
      }
    } catch (error) {
      console.error('Error during redo:', error);
      return false;
    }
  }

  getHistoryLength(): number {
    return this.history.length;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  clearHistory() {
    this.history = [];
    this.currentIndex = -1;
    this.updateButtonStates();
    console.log('History cleared');
  }

  getHistoryMemoryUsage(): number {
    return this.history.reduce((total, entry) => {
      return total + entry.oldText.length + entry.newText.length;
    }, 0);
  }

  getHistoryMemoryUsageFormatted(): string {
    const bytes = this.getHistoryMemoryUsage() * 2; // Approximate (UTF-16)
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }
}

