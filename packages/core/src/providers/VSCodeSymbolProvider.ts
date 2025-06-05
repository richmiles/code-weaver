import { SymbolProvider } from '../resolver/ContextResolver.js';
import { SymbolContext } from '../types/ResolvedContext.js';

export class VSCodeSymbolProvider implements SymbolProvider {
  private webSocketClient: any;

  constructor(webSocketClient: any) {
    this.webSocketClient = webSocketClient;
  }

  async findSymbol(name: string, kind?: string): Promise<SymbolContext[]> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'FIND_SYMBOL',
        payload: { name, kind }
      });

      if (response.success && response.data) {
        return response.data.symbols.map((symbol: any) => this.mapSymbol(symbol));
      } else {
        throw new Error(response.error || 'Failed to find symbol');
      }
    } catch (error) {
      throw new Error(`Failed to find symbol ${name}: ${error}`);
    }
  }

  async getSymbolDefinition(file: string, line: number, character: number): Promise<SymbolContext | null> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'GET_SYMBOL_DEFINITION',
        payload: { file, line, character }
      });

      if (response.success && response.data && response.data.symbol) {
        return this.mapSymbol(response.data.symbol);
      } else {
        return null;
      }
    } catch (error) {
      throw new Error(`Failed to get symbol definition at ${file}:${line}:${character}: ${error}`);
    }
  }

  async getSymbolReferences(file: string, line: number, character: number): Promise<Array<{ file: string; line: number; column: number }>> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'GET_SYMBOL_REFERENCES',
        payload: { file, line, character }
      });

      if (response.success && response.data) {
        return response.data.references;
      } else {
        throw new Error(response.error || 'Failed to get symbol references');
      }
    } catch (error) {
      throw new Error(`Failed to get symbol references at ${file}:${line}:${character}: ${error}`);
    }
  }

  /**
   * Get all symbols in a file (functions, classes, variables, etc.)
   */
  async getFileSymbols(file: string): Promise<SymbolContext[]> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'GET_FILE_SYMBOLS',
        payload: { file }
      });

      if (response.success && response.data) {
        return response.data.symbols.map((symbol: any) => this.mapSymbol(symbol));
      } else {
        throw new Error(response.error || 'Failed to get file symbols');
      }
    } catch (error) {
      throw new Error(`Failed to get symbols for file ${file}: ${error}`);
    }
  }

  /**
   * Search for symbols across the workspace
   */
  async searchSymbols(query: string, limit: number = 50): Promise<SymbolContext[]> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'SEARCH_SYMBOLS',
        payload: { query, limit }
      });

      if (response.success && response.data) {
        return response.data.symbols.map((symbol: any) => this.mapSymbol(symbol));
      } else {
        throw new Error(response.error || 'Failed to search symbols');
      }
    } catch (error) {
      throw new Error(`Failed to search symbols with query "${query}": ${error}`);
    }
  }

  /**
   * Get type definition for a symbol
   */
  async getTypeDefinition(file: string, line: number, character: number): Promise<SymbolContext | null> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'GET_TYPE_DEFINITION',
        payload: { file, line, character }
      });

      if (response.success && response.data && response.data.symbol) {
        return this.mapSymbol(response.data.symbol);
      } else {
        return null;
      }
    } catch (error) {
      throw new Error(`Failed to get type definition at ${file}:${line}:${character}: ${error}`);
    }
  }

  /**
   * Get implementation for an interface or abstract method
   */
  async getImplementation(file: string, line: number, character: number): Promise<SymbolContext[]> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'GET_IMPLEMENTATION',
        payload: { file, line, character }
      });

      if (response.success && response.data) {
        return response.data.symbols.map((symbol: any) => this.mapSymbol(symbol));
      } else {
        return [];
      }
    } catch (error) {
      throw new Error(`Failed to get implementation at ${file}:${line}:${character}: ${error}`);
    }
  }

  private mapSymbol(rawSymbol: any): SymbolContext {
    return {
      name: rawSymbol.name,
      kind: this.mapSymbolKind(rawSymbol.kind),
      file: rawSymbol.file,
      line: rawSymbol.line,
      column: rawSymbol.column,
      range: rawSymbol.range ? {
        start: { line: rawSymbol.range.start.line, character: rawSymbol.range.start.character },
        end: { line: rawSymbol.range.end.line, character: rawSymbol.range.end.character }
      } : undefined,
      content: rawSymbol.content,
      signature: rawSymbol.signature,
      documentation: rawSymbol.documentation,
      dependencies: rawSymbol.dependencies,
      usages: rawSymbol.usages,
      containerName: rawSymbol.containerName
    };
  }

  private mapSymbolKind(vsKind: number): 'function' | 'class' | 'method' | 'variable' | 'type' | 'interface' | 'enum' | 'constant' {
    const kindMap: Record<number, 'function' | 'class' | 'method' | 'variable' | 'type' | 'interface' | 'enum' | 'constant'> = {
      1: 'variable', // file -> variable (fallback)
      2: 'variable', // module -> variable (fallback)
      3: 'variable', // namespace -> variable (fallback)
      4: 'variable', // package -> variable (fallback)
      5: 'class',
      6: 'method',
      7: 'variable', // property -> variable
      8: 'variable', // field -> variable
      9: 'method', // constructor -> method
      10: 'enum',
      11: 'interface',
      12: 'function',
      13: 'variable',
      14: 'constant',
      15: 'variable', // string -> variable (fallback)
      16: 'variable', // number -> variable (fallback)
      17: 'variable', // boolean -> variable (fallback)
      18: 'type', // array -> type
      19: 'type', // object -> type
      20: 'variable', // key -> variable
      21: 'variable', // null -> variable
      22: 'constant', // enumMember -> constant
      23: 'type', // struct -> type
      24: 'method', // event -> method
      25: 'function', // operator -> function
      26: 'type' // typeParameter -> type
    };

    return kindMap[vsKind] || 'variable';
  }
}