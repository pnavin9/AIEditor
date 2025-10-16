import { FileUpdateService } from './fileUpdate';
// Load system prompt text from a .tex file at build time (Vite raw import)
// @ts-ignore - Vite raw import of the system tools prompt
import SYSTEM_TOOLS_PROMPT_RAW from '../system_prompts/toolsPrompt.tex?raw';
import { ExecutionResult, TextUpdateParams } from '../types/shared';

/**
 * Represents a tool/function executor that the LLM can call for edits/info.
 */
export interface FunctionCall {
  functionName: string;
  parameters: Record<string, unknown>;
}

export class FunctionExecutor {
  private fileUpdateService: FileUpdateService;
  private availableFunctions: Map<string, Function>;

  constructor() {
    this.fileUpdateService = new FileUpdateService();
    this.availableFunctions = new Map();
    this.registerFunctions();
  }

  private registerFunctions() {
    this.availableFunctions.set('update_text', this.updateText.bind(this));
  }

  getAvailableTools(): string {
    return String(SYSTEM_TOOLS_PROMPT_RAW || '');
  }

  /**
   * Parse a function call instruction from LLM response.
   */
  parseFunctionCall(response: string): FunctionCall | null {
    const lines = response.trim().split('\n');
    
    // Look for FUNCTION_CALL: pattern
    const functionCallLine = lines.find(line => line.trim().startsWith('FUNCTION_CALL:'));
    if (!functionCallLine) {
      return null;
    }

    const functionName = functionCallLine.replace('FUNCTION_CALL:', '').trim();
    const callIndex = lines.indexOf(functionCallLine);
    const afterLines = lines.slice(callIndex + 1);

    // Try code fence extraction
    const firstTrim = (afterLines[0] || '').trim();
    if (firstTrim.startsWith('```')) {
      let i = 1;
      const collected: string[] = [];
      while (i < afterLines.length && !afterLines[i].trim().startsWith('```')) {
        collected.push(afterLines[i]);
        i++;
      }
      if (i < afterLines.length && afterLines[i].trim().startsWith('```')) {
        const codeContent = collected.join('\n');
        const parameters = { new_text: codeContent } as Record<string, unknown>;
        console.log('Parsed function call from code fence:', { functionName, parameters });
        return { functionName, parameters };
      }
    }
    return null;
  }

  /**
   * Execute a registered function by name.
   */
  async executeFunction(functionCall: FunctionCall): Promise<ExecutionResult> {
    const { functionName, parameters } = functionCall;
    
    const func = this.availableFunctions.get(functionName);
    if (!func) {
      return {
        success: false,
        error: `Function '${functionName}' not found. Available functions: ${Array.from(this.availableFunctions.keys()).join(', ')}`
      };
    }

    try {
      const result = await func(parameters as Record<string, unknown>);
      return {
        success: true,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Function implementations
  /**
   * Update text in the backing file. Alias: replace_text.
   */
  private async updateText(params: Record<string, unknown>): Promise<any> {
    if (!this.isTextUpdateParams(params)) {
      throw new Error('Both old_text and new_text parameters are required');
    }
    const { old_text } = params;
    let { new_text } = params;
    
    if (!old_text || !new_text) {
      throw new Error('Both old_text and new_text parameters are required');
    }

    // Minimal normalization: keep LaTeX as-is; only unify line endings
    if (typeof new_text === 'string') {
      new_text = new_text.replace(/\r\n/g, '\n');
      // Preflight safety: detect unbalanced triple-backtick fences which can break markdown rendering
      const textStr = new_text as string;
      const fenceCount = (textStr.match(/```/g) || []).length;
      if (fenceCount % 2 !== 0) {
        throw new Error('Unsafe edit: unbalanced code fences detected. Please close all ``` blocks.');
      }
    }

    const success = await this.fileUpdateService.updateManual(old_text, new_text);
    
    if (!success) {
      throw new Error('Failed to update the file. Make sure the server is running.');
    }

    return {
      message: 'Text updated successfully',
      old_text,
      new_text
    };
  }

  hasFunctionCall(response: string): boolean {
    return response.includes('FUNCTION_CALL:');
  }

  private isTextUpdateParams(p: unknown): p is TextUpdateParams {
    const cand = p as Partial<TextUpdateParams>;
    return typeof cand?.old_text === 'string' && typeof cand?.new_text === 'string';
  }
}

