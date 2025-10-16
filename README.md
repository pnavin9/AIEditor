# AI Editor with Mistral Chat

A Vite-based application with a two-panel layout: left panel displays documentation with MathJax rendering, right panel provides an AI chat interface powered by Mistral API.

## Features

- 📖 Left Panel: Displays `manual.mmd` with live reload and MathJax support
- 💬 Right Panel: Chat with Mistral AI
- ✨ Select text from left panel and send it to chat with surrounding context
- 🤖 **LLM-Driven Function Calling**: AI decides when to make changes
- ✏️ Edit documents: AI can modify selected text (fix typos, rewrite, format, etc.)
- ↶↷ Undo/Redo: Revert or reapply AI changes
- 🔥 Hot Module Replacement for instant updates

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Mistral API Key:**
   - Create a `.env` file in the project root
   - Add your Mistral API key:
     ```
     VITE_MISTRAL_API_KEY=your_actual_api_key_here
     ```
   - Get your API key from: https://console.mistral.ai/

3. **Run the application:**
   ```bash
   npm start
   ```
   or
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   - Navigate to `http://localhost:3000`

## Usage

### Chatting
- Type your message in the input box at the bottom of the right panel
- Click "Send" or press Enter to send
- Use Shift+Enter for new lines

### Using Selected Text with Context
- Select any text from the left panel (documentation)
- Type your question or instruction
- The AI receives your selection with 5 lines of context before and after
- This helps the AI understand the full context for better responses

### AI-Driven Document Editing
The AI can now decide when to make changes to the document. Simply select text and give natural instructions:

**Examples:**
- "fix the typos in this paragraph"
- "turn this into a checklist"
- "make this simpler"
- "rewrite this in bullet points"
- "convert this to a numbered list"
- "correct the grammar"
- "expand this section with more details"

The AI will:
1. Understand your intent
2. Decide if changes are needed
3. Call the `update_text` function automatically
4. Update the file if modifications are requested
5. Just respond conversationally if no changes are needed

### Undo/Redo Changes
- Click **↶ Undo** to revert the last AI-made change
- Click **↷ Redo** to reapply a change you undid
- History tracks up to 50 changes (with 50KB limit per change)

### How Function Calling Works
The AI has access to these functions:
- `update_text`: Modify text in the document
- `replace_text`: Same as update_text

When you ask the AI to make changes, it outputs:
```
FUNCTION_CALL: update_text
{
  "old_text": "original text",
  "new_text": "modified text"
}
```

The system automatically:
1. Parses the function call
2. Executes it
3. Updates the file
4. Adds to undo history

## Project Structure

```
├── components/
│   ├── LeftPanel.ts          # Documentation display with context extraction
│   ├── RightPanel.ts         # Chat interface with function calling
│   └── UndoRedoButtons.ts    # Undo/redo functionality
├── services/
│   ├── mistral.ts            # Mistral API integration
│   ├── fileUpdate.ts         # File modification service
│   └── functionExecutor.ts   # LLM function calling system
├── types/
│   └── shared.ts             # Shared interfaces and types
├── utils/
│   └── json.ts               # JSON fixing and parsing utilities
├── index.html
├── main.ts
├── style.css
├── manual.mmd               # Documentation content
└── .env                     # API key configuration (create this)
```

## Development

- Lint & format:
  ```bash
  nvm use 20
  npm run lint
  npm run format
  ```

- Start dev servers (Vite + API):
  ```bash
  npm run dev
  ```

## Technologies

- Vite
- TypeScript
- Mistral AI API
- MathJax
- Mathpix Markdown

