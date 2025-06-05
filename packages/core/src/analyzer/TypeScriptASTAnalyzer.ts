import * as ts from 'typescript';
import { SymbolContext } from '../types/ResolvedContext.js';

export interface FunctionAnalysis {
  name: string;
  signature: string;
  content: string;
  dependencies: string[];
  parameters: Array<{ name: string; type: string }>;
  returnType: string;
  isAsync: boolean;
  isExported: boolean;
  documentation?: string;
  startLine: number;
  endLine: number;
}

export interface ClassAnalysis {
  name: string;
  content: string;
  methods: FunctionAnalysis[];
  properties: Array<{ name: string; type: string; isPrivate: boolean }>;
  extends?: string;
  implements: string[];
  dependencies: string[];
  isExported: boolean;
  documentation?: string;
  startLine: number;
  endLine: number;
}

export class TypeScriptASTAnalyzer {
  private program?: ts.Program;
  private typeChecker?: ts.TypeChecker;

  constructor(private webSocketClient: any) {}

  /**
   * Initialize the TypeScript program for a project
   */
  async initializeProject(configPath?: string): Promise<void> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'GET_TYPESCRIPT_CONFIG',
        payload: { configPath }
      });

      if (response.success && response.data) {
        const { files, compilerOptions } = response.data;
        
        this.program = ts.createProgram(files, compilerOptions);
        this.typeChecker = this.program.getTypeChecker();
      } else {
        throw new Error(response.error || 'Failed to get TypeScript configuration');
      }
    } catch (error) {
      console.warn('Failed to initialize TypeScript program, falling back to simple parsing:', error);
    }
  }

  /**
   * Extract function definition and analyze its dependencies
   */
  async extractFunctionDefinition(file: string, functionName: string): Promise<FunctionAnalysis | null> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'READ_FILE',
        payload: { path: file }
      });

      if (!response.success || !response.data) {
        throw new Error('Failed to read file');
      }

      const sourceFile = ts.createSourceFile(
        file,
        response.data.content,
        ts.ScriptTarget.Latest,
        true
      );

      const functions = this.extractFunctions(sourceFile);
      const targetFunction = functions.find(f => f.name === functionName);

      if (targetFunction) {
        return {
          ...targetFunction,
          dependencies: await this.analyzeDependencies(sourceFile, targetFunction.name)
        };
      }

      return null;
    } catch (error) {
      throw new Error(`Failed to extract function ${functionName} from ${file}: ${error}`);
    }
  }

  /**
   * Extract class definition and analyze its structure
   */
  async extractClassDefinition(file: string, className: string): Promise<ClassAnalysis | null> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'READ_FILE',
        payload: { path: file }
      });

      if (!response.success || !response.data) {
        throw new Error('Failed to read file');
      }

      const sourceFile = ts.createSourceFile(
        file,
        response.data.content,
        ts.ScriptTarget.Latest,
        true
      );

      const classes = this.extractClasses(sourceFile);
      const targetClass = classes.find(c => c.name === className);

      if (targetClass) {
        return {
          ...targetClass,
          dependencies: await this.analyzeDependencies(sourceFile, targetClass.name)
        };
      }

      return null;
    } catch (error) {
      throw new Error(`Failed to extract class ${className} from ${file}: ${error}`);
    }
  }

  /**
   * Get all symbols (functions, classes, interfaces, etc.) from a file
   */
  async getFileSymbols(file: string): Promise<SymbolContext[]> {
    try {
      const response = await this.webSocketClient.sendMessage({
        type: 'READ_FILE',
        payload: { path: file }
      });

      if (!response.success || !response.data) {
        throw new Error('Failed to read file');
      }

      const sourceFile = ts.createSourceFile(
        file,
        response.data.content,
        ts.ScriptTarget.Latest,
        true
      );

      const symbols: SymbolContext[] = [];

      // Extract functions
      const functions = this.extractFunctions(sourceFile);
      for (const func of functions) {
        symbols.push({
          name: func.name,
          kind: 'function',
          file,
          line: func.startLine,
          column: 0,
          content: func.content,
          signature: func.signature,
          documentation: func.documentation,
          dependencies: func.dependencies
        });
      }

      // Extract classes
      const classes = this.extractClasses(sourceFile);
      for (const cls of classes) {
        symbols.push({
          name: cls.name,
          kind: 'class',
          file,
          line: cls.startLine,
          column: 0,
          content: cls.content,
          documentation: cls.documentation,
          dependencies: cls.dependencies
        });

        // Add class methods as separate symbols
        for (const method of cls.methods) {
          symbols.push({
            name: `${cls.name}.${method.name}`,
            kind: 'method',
            file,
            line: method.startLine,
            column: 0,
            content: method.content,
            signature: method.signature,
            documentation: method.documentation,
            dependencies: method.dependencies,
            containerName: cls.name
          });
        }
      }

      // Extract interfaces and types
      const interfaces = this.extractInterfaces(sourceFile);
      for (const iface of interfaces) {
        symbols.push({
          name: iface.name,
          kind: 'interface',
          file,
          line: iface.startLine,
          column: 0,
          content: iface.content,
          documentation: iface.documentation
        });
      }

      return symbols;
    } catch (error) {
      throw new Error(`Failed to get symbols for file ${file}: ${error}`);
    }
  }

  /**
   * Find dependencies for a given symbol
   */
  async analyzeDependencies(sourceFile: ts.SourceFile, symbolName: string): Promise<string[]> {
    const dependencies: Set<string> = new Set();

    // Find the target symbol node
    const symbolNode = this.findSymbolNode(sourceFile, symbolName);
    if (!symbolNode) return [];

    // Analyze imports used within the symbol
    const imports = this.extractImports(sourceFile);
    const symbolText = symbolNode.getFullText();

    for (const imp of imports) {
      if (symbolText.includes(imp.name)) {
        dependencies.add(imp.name);
      }
    }

    // Analyze function calls within the symbol
    this.visitNode(symbolNode, (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        dependencies.add(node.expression.text);
      }
    });

    return Array.from(dependencies);
  }

  private extractFunctions(sourceFile: ts.SourceFile): FunctionAnalysis[] {
    const functions: FunctionAnalysis[] = [];

    this.visitNode(sourceFile, (node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const analysis = this.analyzeFunctionNode(node, sourceFile);
        if (analysis) {
          functions.push(analysis);
        }
      }
    });

    return functions;
  }

  private extractClasses(sourceFile: ts.SourceFile): ClassAnalysis[] {
    const classes: ClassAnalysis[] = [];

    this.visitNode(sourceFile, (node) => {
      if (ts.isClassDeclaration(node) && node.name) {
        const analysis = this.analyzeClassNode(node, sourceFile);
        if (analysis) {
          classes.push(analysis);
        }
      }
    });

    return classes;
  }

  private extractInterfaces(sourceFile: ts.SourceFile): Array<{ name: string; content: string; startLine: number; documentation?: string }> {
    const interfaces: Array<{ name: string; content: string; startLine: number; documentation?: string }> = [];

    this.visitNode(sourceFile, (node) => {
      if (ts.isInterfaceDeclaration(node) && node.name) {
        const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const content = node.getFullText().trim();
        const documentation = this.getDocumentation(node);

        interfaces.push({
          name: node.name.text,
          content,
          startLine,
          documentation
        });
      }
    });

    return interfaces;
  }

  private extractImports(sourceFile: ts.SourceFile): Array<{ name: string; from: string; isDefault: boolean }> {
    const imports: Array<{ name: string; from: string; isDefault: boolean }> = [];

    this.visitNode(sourceFile, (node) => {
      if (ts.isImportDeclaration(node) && node.importClause) {
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          const from = moduleSpecifier.text;

          // Default import
          if (node.importClause.name) {
            imports.push({
              name: node.importClause.name.text,
              from,
              isDefault: true
            });
          }

          // Named imports
          if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
            for (const element of node.importClause.namedBindings.elements) {
              imports.push({
                name: element.name.text,
                from,
                isDefault: false
              });
            }
          }
        }
      }
    });

    return imports;
  }

  private analyzeFunctionNode(node: ts.FunctionDeclaration, sourceFile: ts.SourceFile): FunctionAnalysis | null {
    if (!node.name) return null;

    const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
    const content = node.getFullText().trim();
    const signature = this.getFunctionSignature(node);
    const documentation = this.getDocumentation(node);

    const parameters = node.parameters.map(param => ({
      name: param.name.getText(),
      type: param.type ? param.type.getText() : 'any'
    }));

    const returnType = node.type ? node.type.getText() : 'any';
    const isAsync = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword) || false;
    const isExported = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword) || false;

    return {
      name: node.name.text,
      signature,
      content,
      dependencies: [], // Will be filled by analyzeDependencies
      parameters,
      returnType,
      isAsync,
      isExported,
      documentation,
      startLine,
      endLine
    };
  }

  private analyzeClassNode(node: ts.ClassDeclaration, sourceFile: ts.SourceFile): ClassAnalysis | null {
    if (!node.name) return null;

    const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
    const content = node.getFullText().trim();
    const documentation = this.getDocumentation(node);

    const methods: FunctionAnalysis[] = [];
    const properties: Array<{ name: string; type: string; isPrivate: boolean }> = [];

    for (const member of node.members) {
      if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
        const methodAnalysis = this.analyzeMethodNode(member, sourceFile);
        if (methodAnalysis) {
          methods.push(methodAnalysis);
        }
      } else if (ts.isPropertyDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
        const isPrivate = member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.PrivateKeyword) || false;
        properties.push({
          name: member.name.text,
          type: member.type ? member.type.getText() : 'any',
          isPrivate
        });
      }
    }

    const extendsClause = node.heritageClauses?.find(clause => clause.token === ts.SyntaxKind.ExtendsKeyword);
    const extendsType = extendsClause?.types[0]?.expression.getText();

    const implementsClause = node.heritageClauses?.find(clause => clause.token === ts.SyntaxKind.ImplementsKeyword);
    const implementsTypes = implementsClause?.types.map(type => type.expression.getText()) || [];

    const isExported = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword) || false;

    return {
      name: node.name.text,
      content,
      methods,
      properties,
      extends: extendsType,
      implements: implementsTypes,
      dependencies: [], // Will be filled by analyzeDependencies
      isExported,
      documentation,
      startLine,
      endLine
    };
  }

  private analyzeMethodNode(node: ts.MethodDeclaration, sourceFile: ts.SourceFile): FunctionAnalysis | null {
    if (!node.name || !ts.isIdentifier(node.name)) return null;

    const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
    const content = node.getFullText().trim();
    const signature = this.getMethodSignature(node);
    const documentation = this.getDocumentation(node);

    const parameters = node.parameters.map(param => ({
      name: param.name.getText(),
      type: param.type ? param.type.getText() : 'any'
    }));

    const returnType = node.type ? node.type.getText() : 'any';
    const isAsync = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword) || false;

    return {
      name: node.name.text,
      signature,
      content,
      dependencies: [], // Will be filled by analyzeDependencies
      parameters,
      returnType,
      isAsync,
      isExported: false, // Methods are not directly exported
      documentation,
      startLine,
      endLine
    };
  }

  private getFunctionSignature(node: ts.FunctionDeclaration): string {
    const name = node.name?.text || 'anonymous';
    const params = node.parameters.map(p => p.getText()).join(', ');
    const returnType = node.type ? `: ${node.type.getText()}` : '';
    const async = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword) ? 'async ' : '';
    return `${async}function ${name}(${params})${returnType}`;
  }

  private getMethodSignature(node: ts.MethodDeclaration): string {
    const name = ts.isIdentifier(node.name) ? node.name.text : 'method';
    const params = node.parameters.map(p => p.getText()).join(', ');
    const returnType = node.type ? `: ${node.type.getText()}` : '';
    const async = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword) ? 'async ' : '';
    const access = node.modifiers?.find(mod => 
      mod.kind === ts.SyntaxKind.PublicKeyword || 
      mod.kind === ts.SyntaxKind.PrivateKeyword || 
      mod.kind === ts.SyntaxKind.ProtectedKeyword
    )?.getText() || '';
    return `${access} ${async}${name}(${params})${returnType}`.trim();
  }

  private getDocumentation(node: ts.Node): string | undefined {
    const sourceFile = node.getSourceFile();
    const comments = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart());
    
    if (comments && comments.length > 0) {
      const lastComment = comments[comments.length - 1];
      const commentText = sourceFile.text.substring(lastComment.pos, lastComment.end);
      
      // Extract JSDoc content
      if (commentText.startsWith('/**')) {
        return commentText
          .replace(/^\/\*\*/, '')
          .replace(/\*\/$/, '')
          .split('\n')
          .map(line => line.replace(/^\s*\*\s?/, ''))
          .join('\n')
          .trim();
      }
    }
    
    return undefined;
  }

  private findSymbolNode(sourceFile: ts.SourceFile, symbolName: string): ts.Node | null {
    let result: ts.Node | null = null;

    this.visitNode(sourceFile, (node) => {
      if (result) return; // Already found

      if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && 
          node.name && node.name.text === symbolName) {
        result = node;
      }
    });

    return result;
  }

  private visitNode(node: ts.Node, visitor: (node: ts.Node) => void): void {
    visitor(node);
    ts.forEachChild(node, child => this.visitNode(child, visitor));
  }
}