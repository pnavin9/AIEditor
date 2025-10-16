import './style.css';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { UndoRedoButtons } from './components/UndoRedoButtons';
// In dev, we use Vite raw import; in prod we fetch from server
let inputFileContent: string = '' as any;
const isDev = !!(import.meta as any).hot;

// Load MathJax and markdown renderer
const script = document.createElement('script');
script.src = "https://cdn.jsdelivr.net/npm/mathpix-markdown-it@2.0.6/es5/bundle.js";
document.head.append(script);

let leftPanel: LeftPanel;

script.onload = async function() {
  const isLoaded = (window as any).loadMathJax();
  if (isLoaded) {
    console.log('File Loaded');
  }

  // Initialize components
  leftPanel = new LeftPanel('left-panel');
  const rightPanel = new RightPanel('editor', 'enter-btn', 'chat-container', '');
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
  if (isDev) {
    const devModule = await import('./manual.mmd?raw');
    inputFileContent = devModule.default;
  } else {
    try {
      const resp = await fetch('/api/manual');
      inputFileContent = await resp.text();
    } catch (e) {
      console.error('Failed to fetch manual content', e);
      inputFileContent = '';
    }
  }
  leftPanel.loadContent(inputFileContent);

  // In production, listen to SSE updates to refresh content
  if (!isDev) {
    try {
      const es = new EventSource('/api/events');
      es.addEventListener('manual_updated', async () => {
        try {
          const resp = await fetch('/api/manual');
          const text = await resp.text();
          leftPanel.loadContent(text);
        } catch (e) {
          console.error('Failed to refresh manual after update', e);
        }
      });
    } catch (e) {
      console.warn('SSE not available; manual updates will not live-refresh.', e);
    }
  }
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
