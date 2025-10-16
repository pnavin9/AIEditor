import './style.css';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { UndoRedoButtons } from './components/UndoRedoButtons';
import inputFileContent from './manual.mmd?raw';

// Get API key from environment or fallback (development/testing only)
const apiKey = (import.meta as any).env?.VITE_MISTRAL_API_KEY || '';
if (!apiKey) {
  console.warn('VITE_MISTRAL_API_KEY is not set. Requests to Mistral will fail.');
}

// Load MathJax and markdown renderer
const script = document.createElement('script');
script.src = "https://cdn.jsdelivr.net/npm/mathpix-markdown-it@2.0.6/es5/bundle.js";
document.head.append(script);

let leftPanel: LeftPanel;

script.onload = function() {
  const isLoaded = (window as any).loadMathJax();
  if (isLoaded) {
    console.log('File Loaded');
  }

  // Initialize components
  leftPanel = new LeftPanel('left-panel');
  const rightPanel = new RightPanel('editor', 'enter-btn', 'chat-container', apiKey);
  const undoRedoButtons = new UndoRedoButtons('undo-btn', 'redo-btn');

  // Connect undo/redo to right panel
  rightPanel.setUndoRedoButtons(undoRedoButtons);

  // Set up enter button handler to use selected text from left panel
  rightPanel.setEnterClickHandler(() => {
    const selectedText = leftPanel.getSelectedText();
    if (selectedText) {
      return selectedText;
    }
  });

  // Set up handler to get selected text
  rightPanel.setGetSelectedTextHandler(() => {
    return leftPanel.getLastSelectedText();
  });

  // Set up handler to get text with context
  rightPanel.setGetTextContextHandler((text: string) => {
    return leftPanel.getTextWithContext(text, 10);
  });

  // Provide document outline when no selection is present
  rightPanel.setGetOutlineHandler((maxPreview) => {
    return (leftPanel as any).getDocumentOutline(maxPreview);
  });

  // Set up handler to show preview in left panel
  rightPanel.setShowPreviewHandler((preview) => {
    leftPanel.showChangePreview(preview);
  });

  // Load content into left panel
  leftPanel.loadContent(inputFileContent);
};

// Enable HMR for manual.mmd changes in development environment
// For production environment, use websockets.
if (import.meta.hot) {
  import.meta.hot.accept('./manual.mmd?raw', (newModule) => {
    if (newModule && leftPanel) {
      console.log('Manual content updated, reloading...');
      leftPanel.loadContent(newModule.default);
    }
  });
}
