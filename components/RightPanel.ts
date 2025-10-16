import { MistralService } from '../services/mistral';
import { FunctionExecutor, FunctionCall } from '../services/functionExecutor';
import { TextContext, ChangePreview, DocumentSection } from './LeftPanel';
import { ContextPill } from './ContextPill';
import { UndoRedoButtons } from './UndoRedoButtons';
import { ChatMessage } from '../types/shared';
import systemMessageTemplate from '../system_prompts/systemMessage.txt?raw';

/**
 * Chat + tool-calling UI controller for the right panel.
 */
export class RightPanel {
  private editor: HTMLTextAreaElement | null;
  private enterButton: HTMLButtonElement | null;
  private chatContainer: HTMLElement | null;
  private newChatButton: HTMLButtonElement | null = null;
  private mistralService: MistralService;
  private functionExecutor: FunctionExecutor;
  private messages: ChatMessage[] = [];
  private contextPill?: ContextPill;
  private onEnterClick?: () => string | void;
  private onGetSelectedText?: () => string;
  private onGetTextContext?: (text: string) => TextContext;
  private onGetOutline?: (maxPreviewChars?: number) => DocumentSection[];
  private onShowPreview?: (preview: ChangePreview) => void;
  private undoRedoButtons?: UndoRedoButtons;

  constructor(editorId: string, buttonId: string, chatContainerId: string, apiKey: string) {
    this.editor = document.getElementById(editorId) as HTMLTextAreaElement;
    
    this.enterButton = document.getElementById(buttonId) as HTMLButtonElement;

    this.chatContainer = document.getElementById(chatContainerId);
    
    this.mistralService = new MistralService(apiKey);
    this.functionExecutor = new FunctionExecutor();
    this.setupEventListeners();
    this.contextPill = new ContextPill('right-panel', '.input-area');
    this.initializeSystemMessage();
  }

  private updateContextFromSelection() {
    this.contextPill?.updateFromSelection(this.onGetSelectedText, this.onGetTextContext);
  }
  private initializeSystemMessage() {
    // Add system message with available tools
    const toolsText = this.functionExecutor.getAvailableTools();
    const content = systemMessageTemplate.replace('{{TOOLS}}', toolsText);
    const systemMessage: ChatMessage = {
      role: 'system',
      content,
    };
    this.messages.push(systemMessage);
  }

  private setupEventListeners() {
    if (this.editor) {
      this.editor.addEventListener('input', (e) => {
        const content = (e.target as HTMLTextAreaElement).value;
        this.onContentChange(content);
      });

      // Allow Enter to send, Shift+Enter for new line
      this.editor.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
    }

    if (this.enterButton) {
      this.enterButton.addEventListener('click', () => {
        this.handleSendMessage();
      });
    }

    // New chat button
    this.newChatButton = document.getElementById('new-chat-btn') as HTMLButtonElement;
    if (this.newChatButton) {
      this.newChatButton.addEventListener('click', () => this.startNewChat());
    }
    // Update context pill when typing or focusing editor
    this.editor?.addEventListener('focus', () => this.updateContextFromSelection());
    this.editor?.addEventListener('input', () => this.updateContextFromSelection());
    // Track selection changes to update pill
    document.addEventListener('selectionchange', () => this.updateContextFromSelection());
  }

  private async handleSendMessage() {
    let userMessage = this.editor?.value.trim() || '';
    
    // Check if there's a custom handler (for selected text)
    if (this.onEnterClick && !userMessage) {
      const result = this.onEnterClick();
      if (typeof result === 'string' && result) {
        userMessage = result;
      }
    }

    if (!userMessage) return;

    // Always capture raw selected text from left panel (source of truth for replacement)
    const selectedText = (this.contextPill && this.contextPill.isIgnoring()) ? '' : (this.onGetSelectedText ? this.onGetSelectedText() : '');
    const rawSelection = selectedText; // raw from LeftPanel already maps rendered → raw

    // Disable button and clear input
    this.setButtonState(false);
    if (this.editor) {
      this.editor.value = '';
    }

    // Get context if there's selected text
    const textContext = selectedText && this.onGetTextContext ? this.onGetTextContext(selectedText) : null;
    
    if (textContext) {
      console.log('Context before length:', textContext.contextBefore?.length || 0);
      console.log('Context after length:', textContext.contextAfter?.length || 0);
    }

    // Build the message to send to LLM - include context if available
    let messageToSend = userMessage;
    if (selectedText && textContext && (textContext.contextBefore || textContext.contextAfter)) {
      console.log('✓ Including CONTEXT with user message');
      messageToSend = `${userMessage}

Here is the selected text with surrounding context:

--- CONTEXT BEFORE ---
${textContext.contextBefore}

--- SELECTED TEXT ---
${textContext.selectedText}

--- CONTEXT AFTER ---
${textContext.contextAfter}`;
    } else if (selectedText) {
      console.log('✓ Including selected text (no context available)');
      messageToSend = `${userMessage}

Selected text: "${selectedText}"`;
    } else {
      // No selection: include a compact outline to provide context without full file
      if (this.onGetOutline) {
        const outline = this.onGetOutline(400);
        if (outline && outline.length) {
          const outlineText = outline
            .map((s, i) => `- [${i + 1}] ${s.title}\n${s.textPreview}`)
            .join('\n\n');
          console.log('✓ Including document outline in request');
          messageToSend = `${userMessage}

Here is a compact outline of the document for context. Summaries or operations should reference sections by index:

${outlineText}`;
        }
      }
    }

    // Add user message (display original message in chat)
    this.addMessage('user', userMessage);
    this.messages.push({ role: 'user', content: messageToSend });

    // Stream the response and progressively render
    const assistantPlaceholder = document.createElement('div');
    assistantPlaceholder.className = 'message assistant';
    assistantPlaceholder.textContent = '';
    this.chatContainer?.appendChild(assistantPlaceholder);

    let fullText = '';
    let suppressAssistantRender = false;
    try {
      await this.mistralService.chatStream(
        this.messages,
        (delta) => {
          fullText += delta;
          // If stream looks like a function call, don't render raw FUNCTION_CALL text
          if (!suppressAssistantRender && this.functionExecutor.hasFunctionCall(fullText)) {
            suppressAssistantRender = true;
            if (assistantPlaceholder) assistantPlaceholder.textContent = '';
            return;
          }
          if (assistantPlaceholder && !suppressAssistantRender) {
            assistantPlaceholder.textContent = fullText;
            if (this.chatContainer) {
              this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
            }
          }
        },
        async (finalText) => {
          const content = (finalText || '').trim();

          // If the streamed content encodes a function call, handle it and do NOT render the raw FUNCTION_CALL text
          if (content && this.functionExecutor.hasFunctionCall(content)) {
            try {
              const functionCall = this.functionExecutor.parseFunctionCall(content);
              // Clear placeholder text
              if (assistantPlaceholder) assistantPlaceholder.textContent = '';

              if (functionCall && (functionCall.functionName === 'update_text' || functionCall.functionName === 'replace_text')) {
                if (this.onShowPreview) {
                  this.addMessage('assistant', '📝 Preparing changes for your review...');
                  const coercedNewText = typeof functionCall.parameters.new_text === 'string'
                    ? functionCall.parameters.new_text
                    : String(functionCall.parameters.new_text ?? '');
                  const preview: ChangePreview = {
                    oldText: rawSelection,
                    newText: coercedNewText,
                    onAccept: async () => {
                      const fc = { ...functionCall, parameters: { ...functionCall.parameters, old_text: rawSelection } } as FunctionCall;
                      await this.executeEdit(fc);
                    },
                    onReject: () => {
                      this.addMessage('system', 'Changes rejected by user');
                      this.messages.push({ role: 'assistant', content: 'Changes rejected' });
                    }
                  };
                  this.onShowPreview(preview);
                }
              } else if (functionCall) {
                const result = await this.functionExecutor.executeFunction(functionCall);
                if (result.success) {
                  this.addMessage('assistant', `✓ Function executed successfully!\n\n**Action:** ${functionCall.functionName}\n\n**Result:** ${JSON.stringify(result.result, null, 2)}`);
                } else {
                  this.addMessage('assistant', `✗ Function execution failed!\n\n**Error:** ${result.error}`);
                }
              }
              return; // handled tool call; don't render raw content
            } catch (e) {
              console.error('Function call parse/execute error:', e);
            }
          }

          // Otherwise, finalize render as a normal assistant message
          if (assistantPlaceholder) {
            if (typeof (window as any).render === 'function') {
              const html = (window as any).render(finalText, { htmlTags: true });
              assistantPlaceholder.innerHTML = html;
            } else {
              assistantPlaceholder.textContent = finalText;
            }
          }
          this.messages.push({ role: 'assistant', content: finalText });
        }
      );
    } catch (error) {
      this.addMessage('system', 'Error: Failed to get response from Mistral API. Please check your API key.');
      console.error('Mistral API error:', error);
    } finally {
      this.setButtonState(true);
    }
  }

  private addMessage(role: 'user' | 'assistant' | 'system', content: string) {
    if (!this.chatContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    // Render markdown for assistant messages, plain text for others
    if (role === 'assistant' && typeof (window as any).render === 'function') {
      const options = {
        htmlTags: true
      };
      const html = (window as any).render(content, options);
      messageDiv.innerHTML = html;
    } else {
      messageDiv.textContent = content;
    }
    
    this.chatContainer.appendChild(messageDiv);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  private setButtonState(enabled: boolean) {
    if (this.enterButton) {
      this.enterButton.disabled = !enabled;
      this.enterButton.textContent = enabled ? 'Send' : 'Sending...';
    }
  }

  private onContentChange(_content: string) {
    // Can add logic here if needed
  }

  setEnterClickHandler(handler: () => string | void) {
    this.onEnterClick = handler;
  }

  setGetSelectedTextHandler(handler: () => string) {
    this.onGetSelectedText = handler;
  }

  setGetTextContextHandler(handler: (text: string) => TextContext) {
    this.onGetTextContext = handler;
  }

  setGetOutlineHandler(handler: (maxPreviewChars?: number) => DocumentSection[]) {
    this.onGetOutline = handler;
  }

  setUndoRedoButtons(undoRedoButtons: UndoRedoButtons) {
    this.undoRedoButtons = undoRedoButtons;
  }

  setShowPreviewHandler(handler: (preview: ChangePreview) => void) {
    this.onShowPreview = handler;
  }

  private async executeEdit(functionCall: FunctionCall) {
    console.log('Executing accepted function:', functionCall);
    const result = await this.functionExecutor.executeFunction(functionCall);
    
    if (result.success) {
      // Add to undo/redo history
      if (this.undoRedoButtons) {
        const params = functionCall.parameters as { old_text?: unknown; new_text?: unknown };
        if (typeof params.old_text === 'string' && typeof params.new_text === 'string') {
          this.undoRedoButtons.addToHistory(params.old_text, params.new_text);
        }
      }
      
      this.addMessage('assistant', '✓ Changes applied successfully!');
      this.messages.push({ 
        role: 'assistant', 
        content: `Applied changes successfully` 
      });
    } else {
      this.addMessage('system', `✗ Error: ${result.error}`);
      this.messages.push({ 
        role: 'assistant', 
        content: `Failed to apply changes: ${result.error}` 
      });
    }
  }

  getValue(): string {
    return this.editor?.value || '';
  }

  setValue(content: string) {
    if (this.editor) {
      this.editor.value = content;
    }
  }

  clearChat() {
    this.messages = [];
    if (this.chatContainer) {
      this.chatContainer.innerHTML = '';
    }
  }

  startNewChat() {
    // Clear chat UI
    this.clearChat();
    // Re-initialize system message and reset editor
    this.initializeSystemMessage();
    this.setValue('');
    // Provide visual feedback
    this.addMessage('system', 'Started a new chat');
  }
}
