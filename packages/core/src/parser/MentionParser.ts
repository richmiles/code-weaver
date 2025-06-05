import { MentionToken, MentionSuggestion, MentionContext } from '../types/MentionToken.js';

export class MentionParser {
  private static readonly MENTION_REGEX = /@(\w+)(?::([^\s@(),]+))?(?:\(([^)]*)\))?/g;
  private static readonly PARTIAL_MENTION_REGEX = /@(\w*)$/;

  /**
   * Parse a text string and extract all @mention tokens
   */
  parse(text: string): MentionToken[] {
    const tokens: MentionToken[] = [];
    let match;
    
    // Reset regex state
    MentionParser.MENTION_REGEX.lastIndex = 0;
    
    while ((match = MentionParser.MENTION_REGEX.exec(text)) !== null) {
      const [fullMatch, type, value = '', paramsStr = ''] = match;
      const params = this.parseParams(paramsStr);
      
      // Validate mention type
      if (this.isValidMentionType(type)) {
        // Clean value by removing trailing punctuation
        const cleanValue = value.replace(/[,.?!]+$/, '');
        
        tokens.push({
          type: type as MentionToken['type'],
          value: cleanValue,
          params,
          position: [match.index, match.index + fullMatch.length],
          raw: fullMatch
        });
      }
    }
    
    return tokens;
  }

  /**
   * Get autocomplete suggestions for partial @mention input
   */
  autocomplete(text: string, position: number, context?: MentionContext): MentionSuggestion[] {
    const beforeCursor = text.substring(0, position);
    const match = beforeCursor.match(MentionParser.PARTIAL_MENTION_REGEX);
    
    if (!match) {
      return [];
    }
    
    const partialType = match[1];
    const suggestions = this.generateSuggestions(partialType, context);
    
    // Sort by priority and relevance
    return suggestions.sort((a, b) => {
      // Exact matches first
      if (a.type === partialType && b.type !== partialType) {return -1;}
      if (b.type === partialType && a.type !== partialType) {return 1;}
      
      // Then by priority
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) {return priorityDiff;}
      
      // Then alphabetically
      return a.label.localeCompare(b.label);
    });
  }

  /**
   * Extract the current partial mention at cursor position
   */
  getPartialMentionAtPosition(text: string, position: number): { start: number; end: number; partial: string } | null {
    const beforeCursor = text.substring(0, position);
    const afterCursor = text.substring(position);
    
    const beforeMatch = beforeCursor.match(/@([^@\s]*)$/);
    if (!beforeMatch) {
      return null;
    }
    
    const start = beforeMatch.index!;
    const partial = beforeMatch[0];
    
    // Look ahead for the end of the mention
    const afterMatch = afterCursor.match(/^([^@\s]*)/);
    const afterPart = afterMatch ? afterMatch[1] : '';
    
    return {
      start,
      end: position + afterPart.length,
      partial: partial + afterPart
    };
  }

  private parseParams(paramsStr: string): Record<string, string> {
    if (!paramsStr.trim()) {
      return {};
    }
    
    const params: Record<string, string> = {};
    
    // Handle simple key=value pairs separated by commas
    const pairs = paramsStr.split(',').map(p => p.trim());
    
    for (const pair of pairs) {
      const [key, ...valueParts] = pair.split('=');
      if (key && valueParts.length > 0) {
        params[key.trim()] = valueParts.join('=').trim();
      } else if (key) {
        // Handle flags like "staged" in @diff(staged)
        params[key.trim()] = 'true';
      }
    }
    
    return params;
  }

  private isValidMentionType(type: string): boolean {
    const validTypes = [
      'file', 'function', 'class', 'method', 'type', 'interface', 'variable',
      'error', 'diff', 'stack', 'test', 'deps', 'imports', 'exports',
      'folder', 'directory', 'recent', 'open', 'modified', 'branch', 'commit',
      'group', 'recipe', 'template'
    ];
    
    return validTypes.includes(type);
  }

  private generateSuggestions(partialType: string, context?: MentionContext): MentionSuggestion[] {
    const suggestions: MentionSuggestion[] = [];
    
    // Core file and code references
    if ('file'.startsWith(partialType)) {
      suggestions.push({
        type: 'file',
        value: '',
        label: '@file',
        description: 'Reference a specific file',
        icon: '📄',
        priority: 10
      });
    }
    
    if ('function'.startsWith(partialType)) {
      suggestions.push({
        type: 'function',
        value: '',
        label: '@function',
        description: 'Reference a function definition and its dependencies',
        icon: '⚡',
        priority: 9
      });
    }
    
    if ('class'.startsWith(partialType)) {
      suggestions.push({
        type: 'class',
        value: '',
        label: '@class',
        description: 'Reference a class definition and its usage',
        icon: '🏛️',
        priority: 9
      });
    }
    
    // Smart context aggregators - prioritize if there are relevant items
    if ('error'.startsWith(partialType)) {
      const priority = context?.hasErrors ? 15 : 8;
      const metadata = context?.hasErrors ? { errorCount: 1 } : undefined;
      
      suggestions.push({
        type: 'error',
        value: '',
        label: '@error',
        description: 'Current errors and diagnostics',
        icon: '🔴',
        priority,
        metadata
      });
    }
    
    if ('diff'.startsWith(partialType)) {
      const priority = context?.hasDiff ? 14 : 7;
      
      suggestions.push({
        type: 'diff',
        value: '',
        label: '@diff',
        description: 'Current Git changes',
        icon: '📝',
        priority
      });
    }
    
    if ('test'.startsWith(partialType)) {
      const priority = context?.hasFailingTests ? 13 : 6;
      
      suggestions.push({
        type: 'test',
        value: '',
        label: '@test',
        description: 'Test files and results',
        icon: '🧪',
        priority
      });
    }
    
    // Project structure
    if ('folder'.startsWith(partialType)) {
      suggestions.push({
        type: 'folder',
        value: '',
        label: '@folder',
        description: 'All files in a directory',
        icon: '📁',
        priority: 6
      });
    }
    
    if ('directory'.startsWith(partialType)) {
      suggestions.push({
        type: 'directory',
        value: '',
        label: '@directory',
        description: 'All files in a directory (alias for @folder)',
        icon: '📁',
        priority: 6
      });
    }
    
    if ('recent'.startsWith(partialType)) {
      const fileCount = context?.recentFiles?.length || 0;
      
      suggestions.push({
        type: 'recent',
        value: '',
        label: '@recent',
        description: 'Recently edited files',
        icon: '🕒',
        priority: 8,
        metadata: fileCount > 0 ? { fileCount } : undefined
      });
    }
    
    if ('open'.startsWith(partialType)) {
      const fileCount = context?.openFiles?.length || 0;
      
      suggestions.push({
        type: 'open',
        value: '',
        label: '@open',
        description: 'Currently open files',
        icon: '📂',
        priority: 7,
        metadata: fileCount > 0 ? { fileCount } : undefined
      });
    }
    
    // Advanced types
    if ('method'.startsWith(partialType)) {
      suggestions.push({
        type: 'method',
        value: '',
        label: '@method',
        description: 'Specific class method',
        icon: '🔧',
        priority: 5
      });
    }
    
    if ('type'.startsWith(partialType)) {
      suggestions.push({
        type: 'type',
        value: '',
        label: '@type',
        description: 'Type definition and usages',
        icon: '🏷️',
        priority: 5
      });
    }
    
    if ('interface'.startsWith(partialType)) {
      suggestions.push({
        type: 'interface',
        value: '',
        label: '@interface',
        description: 'Interface definition and implementations',
        icon: '🔗',
        priority: 5
      });
    }
    
    return suggestions;
  }
}