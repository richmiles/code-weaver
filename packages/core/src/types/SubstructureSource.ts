import { ContextSource } from './ContextSource.js';
import { SourceType } from './SourceType.js';

export enum SubstructureType {
  FUNCTION = 'function',
  METHOD = 'method',
  CLASS = 'class',
  INTERFACE = 'interface',
  TYPE = 'type',
  ENUM = 'enum',
  VARIABLE = 'variable',
  CONSTANT = 'constant',
  PROPERTY = 'property',
  NAMESPACE = 'namespace',
  MODULE = 'module',
  HEADING = 'heading', // For Markdown documents
  SECTION = 'section', // For documentation
  TEST = 'test', // Test functions/suites
  HOOK = 'hook' // React hooks, lifecycle methods, etc.
}

export enum Visibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  PROTECTED = 'protected',
  INTERNAL = 'internal'
}

export interface CodeLocation {
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}

export interface FunctionParameter {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
}

export interface SubstructureMetadata {
  name: string;
  type: SubstructureType;
  visibility?: Visibility;
  isStatic?: boolean;
  isAsync?: boolean;
  isAbstract?: boolean;
  returnType?: string;
  parameters?: FunctionParameter[];
  decorators?: string[]; // @decorators, annotations
  documentation?: string; // JSDoc, docstrings, etc.
  parentName?: string; // Class/namespace this belongs to
  headingLevel?: number; // For Markdown headings (1-6)
}

export interface SubstructureSource extends ContextSource {
  type: SourceType.SUBSTRUCTURE;
  sourceFileId: string; // Reference to parent FileSource
  location: CodeLocation;
  structureMetadata: SubstructureMetadata;
  content?: string; // Optional cached content
  signature?: string; // Function signature, class declaration, etc.
}