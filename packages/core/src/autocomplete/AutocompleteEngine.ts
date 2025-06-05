import { MentionSuggestion, MentionContext } from '../types/MentionToken.js';
import { LRUCache } from '../performance/LRUCache.js';
import { SecurityValidator } from '../validation/SecurityValidator.js';

export interface AutocompleteProvider {
  getType(): string;
  getSuggestions(query: string, context?: MentionContext): Promise<MentionSuggestion[]>;
}

export interface FuzzySearchOptions {
  threshold: number; // minimum score (0-1)
  maxResults: number;
  caseSensitive: boolean;
}

export class FuzzySearch {
  private static readonly DEFAULT_OPTIONS: FuzzySearchOptions = {
    threshold: 0.3,
    maxResults: 50,
    caseSensitive: false
  };

  /**
   * Calculate fuzzy search score between query and target
   * Uses a simple character-based scoring algorithm
   */
  static score(query: string, target: string, options: Partial<FuzzySearchOptions> = {}): number {
    const opts = { ...FuzzySearch.DEFAULT_OPTIONS, ...options };
    
    if (!query) {return 1;} // empty query matches everything
    if (!target) {return 0;}
    
    const q = opts.caseSensitive ? query : query.toLowerCase();
    const t = opts.caseSensitive ? target : target.toLowerCase();
    
    if (t.includes(q)) {
      // Exact substring match gets high score
      const startIndex = t.indexOf(q);
      const positionBonus = 1 - (startIndex / t.length) * 0.3; // earlier matches get bonus
      return 0.8 + positionBonus * 0.2;
    }
    
    // Character-by-character fuzzy matching
    let queryIndex = 0;
    let matches = 0;
    let consecutiveMatches = 0;
    let maxConsecutive = 0;
    
    for (let targetIndex = 0; targetIndex < t.length && queryIndex < q.length; targetIndex++) {
      if (t[targetIndex] === q[queryIndex]) {
        matches++;
        queryIndex++;
        consecutiveMatches++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
      } else {
        consecutiveMatches = 0;
      }
    }
    
    // Didn't match all characters
    if (queryIndex < q.length) {
      return 0;
    }
    
    // Calculate score based on match ratio and consecutive matches
    const matchRatio = matches / Math.max(q.length, t.length);
    const consecutiveBonus = maxConsecutive / q.length * 0.3;
    
    return Math.min(matchRatio + consecutiveBonus, 0.75); // cap at 0.75 for fuzzy matches
  }

  /**
   * Filter and sort items by fuzzy search score
   */
  static filter<T extends { label: string }>(
    items: T[],
    query: string,
    options: Partial<FuzzySearchOptions> = {}
  ): Array<T & { score: number }> {
    const opts = { ...FuzzySearch.DEFAULT_OPTIONS, ...options };
    
    const scored = items
      .map(item => ({
        ...item,
        score: FuzzySearch.score(query, item.label, opts)
      }))
      .filter(item => item.score >= opts.threshold)
      .sort((a, b) => b.score - a.score);
    
    return scored.slice(0, opts.maxResults);
  }
}

export interface AutocompleteOptions {
  maxSuggestions?: number;
  cacheSize?: number;
  cacheTTL?: number;
  enableFuzzySearch?: boolean;
  fuzzyThreshold?: number;
}

export class AutocompleteEngine {
  private providers: Map<string, AutocompleteProvider> = new Map();
  private cache: LRUCache<string, { suggestions: MentionSuggestion[]; timestamp: number }>;
  private readonly CACHE_TTL: number;
  private readonly options: Required<AutocompleteOptions>;
  private indexCache: Map<string, TrieNode> = new Map();
  
  constructor(options: AutocompleteOptions = {}) {
    this.options = {
      maxSuggestions: 20,
      cacheSize: 1000,
      cacheTTL: 5000,
      enableFuzzySearch: true,
      fuzzyThreshold: 0.3,
      ...options
    };
    
    this.CACHE_TTL = this.options.cacheTTL;
    this.cache = new LRUCache(this.options.cacheSize);
  }

  /**
   * Register an autocomplete provider for a specific mention type
   */
  registerProvider(provider: AutocompleteProvider): void {
    this.providers.set(provider.getType(), provider);
  }

  /**
   * Get autocomplete suggestions for a given query and context
   */
  async getSuggestions(
    mentionType: string,
    query: string,
    context?: MentionContext
  ): Promise<MentionSuggestion[]> {
    // Validate input
    const queryValidation = SecurityValidator.validateSearchQuery(query);
    if (!queryValidation.isValid) {
      console.warn('Invalid search query:', queryValidation.errors);
      return [];
    }
    
    const cacheKey = `${mentionType}:${query}:${JSON.stringify(context || {})}`;
    const cached = this.cache.get(cacheKey);
    
    // Return cached results if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.suggestions.slice(0, this.options.maxSuggestions);
    }

    const provider = this.providers.get(mentionType);
    if (!provider) {
      return [];
    }

    try {
      let suggestions = await provider.getSuggestions(query, context);
      
      // Apply intelligent filtering and ranking
      suggestions = this.rankSuggestions(suggestions, query, context);
      
      // Limit results
      suggestions = suggestions.slice(0, this.options.maxSuggestions);
      
      // Cache the results
      this.cache.set(cacheKey, {
        suggestions,
        timestamp: Date.now()
      });
      
      return suggestions;
    } catch (error) {
      console.error(`Error getting suggestions for ${mentionType}:`, error);
      return [];
    }
  }

  /**
   * Get suggestions for multiple mention types and merge them
   */
  async getMultiTypeSuggestions(
    mentionTypes: string[],
    query: string,
    context?: MentionContext
  ): Promise<MentionSuggestion[]> {
    const allSuggestions = await Promise.all(
      mentionTypes.map(type => this.getSuggestions(type, query, context))
    );

    // Flatten and deduplicate by label
    const merged = new Map<string, MentionSuggestion>();
    
    for (const suggestions of allSuggestions) {
      for (const suggestion of suggestions) {
        const existing = merged.get(suggestion.label);
        if (!existing || suggestion.priority! > existing.priority!) {
          merged.set(suggestion.label, suggestion);
        }
      }
    }

    // Sort by priority and fuzzy score
    const sorted = Array.from(merged.values()).sort((a, b) => {
      // Priority first
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) {return priorityDiff;}
      
      // Then by fuzzy search score
      const scoreA = FuzzySearch.score(query, a.label);
      const scoreB = FuzzySearch.score(query, b.label);
      return scoreB - scoreA;
    });

    return sorted;
  }

  /**
   * Intelligently rank suggestions based on multiple factors
   */
  private rankSuggestions(
    suggestions: MentionSuggestion[],
    query: string,
    context?: MentionContext
  ): MentionSuggestion[] {
    return suggestions
      .map(suggestion => ({
        ...suggestion,
        computedScore: this.calculateSuggestionScore(suggestion, query, context)
      }))
      .sort((a, b) => (b.computedScore || 0) - (a.computedScore || 0))
      .map(({ computedScore, ...suggestion }) => suggestion);
  }
  
  /**
   * Calculate comprehensive suggestion score
   */
  private calculateSuggestionScore(
    suggestion: MentionSuggestion,
    query: string,
    context?: MentionContext
  ): number {
    let score = suggestion.priority || 0;
    
    // Fuzzy search score
    if (this.options.enableFuzzySearch) {
      const fuzzyScore = FuzzySearch.score(query, suggestion.label, {
        threshold: this.options.fuzzyThreshold
      });
      score += fuzzyScore * 10;
    }
    
    // Context-based scoring
    if (context) {
      // Recently used items get bonus
      if (context.recentMentions?.some(token => token.value === suggestion.value)) {
        score += 5;
      }
      
      // Current workspace context
      if (suggestion.type === 'file' && context.currentWorkspace) {
        if (suggestion.value.startsWith(context.currentWorkspace)) {
          score += 3;
        }
      }
      
      // Current file context
      if (context.currentFile && suggestion.value === context.currentFile) {
        score += 8;
      }
    }
    
    // Frequency-based scoring (if available)
    if (suggestion.metadata?.usageCount) {
      score += Math.log(suggestion.metadata.usageCount + 1);
    }
    
    return score;
  }
  
  /**
   * Get suggestions with smart prefix matching using Trie
   */
  async getSmartSuggestions(
    mentionType: string,
    query: string,
    context?: MentionContext
  ): Promise<MentionSuggestion[]> {
    // For short queries, use trie-based prefix matching for better performance
    if (query.length <= 2) {
      return this.getTrieBasedSuggestions(mentionType, query, context);
    }
    
    // For longer queries, use full fuzzy search
    return this.getSuggestions(mentionType, query, context);
  }
  
  /**
   * Trie-based prefix matching for fast short query completion
   */
  private async getTrieBasedSuggestions(
    mentionType: string,
    query: string,
    context?: MentionContext
  ): Promise<MentionSuggestion[]> {
    const trie = await this.getOrBuildTrie(mentionType);
    const prefixMatches = this.searchTrie(trie, query.toLowerCase());
    
    return prefixMatches
      .slice(0, this.options.maxSuggestions)
      .map(match => match.suggestion);
  }
  
  /**
   * Build or retrieve cached trie for a mention type
   */
  private async getOrBuildTrie(mentionType: string): Promise<TrieNode> {
    let trie = this.indexCache.get(mentionType);
    if (!trie) {
      trie = await this.buildTrieForType(mentionType);
      this.indexCache.set(mentionType, trie);
    }
    return trie;
  }
  
  /**
   * Build trie index for faster prefix searching
   */
  private async buildTrieForType(mentionType: string): Promise<TrieNode> {
    const provider = this.providers.get(mentionType);
    if (!provider) {
      return new TrieNode();
    }
    
    // Get all suggestions without query for indexing
    const allSuggestions = await provider.getSuggestions('', undefined);
    const trie = new TrieNode();
    
    for (const suggestion of allSuggestions) {
      this.insertIntoTrie(trie, suggestion.label.toLowerCase(), suggestion);
    }
    
    return trie;
  }
  
  /**
   * Insert suggestion into trie
   */
  private insertIntoTrie(root: TrieNode, word: string, suggestion: MentionSuggestion): void {
    let current = root;
    
    for (const char of word) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char)!;
    }
    
    current.isEndOfWord = true;
    current.suggestions.push(suggestion);
  }
  
  /**
   * Search trie for prefix matches
   */
  private searchTrie(root: TrieNode, prefix: string): Array<{ suggestion: MentionSuggestion; distance: number }> {
    let current = root;
    
    // Navigate to prefix end
    for (const char of prefix) {
      if (!current.children.has(char)) {
        return [];
      }
      current = current.children.get(char)!;
    }
    
    // Collect all suggestions from this node down
    const results: Array<{ suggestion: MentionSuggestion; distance: number }> = [];
    this.collectTrieSuggestions(current, results, 0);
    
    return results.sort((a, b) => a.distance - b.distance);
  }
  
  /**
   * Collect all suggestions from trie node
   */
  private collectTrieSuggestions(
    node: TrieNode,
    results: Array<{ suggestion: MentionSuggestion; distance: number }>,
    distance: number
  ): void {
    if (node.isEndOfWord) {
      for (const suggestion of node.suggestions) {
        results.push({ suggestion, distance });
      }
    }
    
    for (const child of node.children.values()) {
      this.collectTrieSuggestions(child, results, distance + 1);
    }
  }
  
  /**
   * Invalidate cache for a specific provider
   */
  invalidateCache(mentionType?: string): void {
    if (mentionType) {
      // Remove entries for specific type
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${mentionType}:`)) {
          this.cache.delete(key);
        }
      }
      // Remove trie cache
      this.indexCache.delete(mentionType);
    } else {
      // Clear all caches
      this.cache.clear();
      this.indexCache.clear();
    }
  }

  /**
   * Clear all cached suggestions
   */
  clearCache(): void {
    this.cache.clear();
    this.indexCache.clear();
  }
  
  /**
   * Get autocomplete statistics
   */
  getStats(): {
    cacheSize: number;
    providersCount: number;
    indexedTypes: string[];
  } {
    return {
      cacheSize: this.cache.size(),
      providersCount: this.providers.size,
      indexedTypes: Array.from(this.indexCache.keys())
    };
  }
}

/**
 * Trie node for efficient prefix searching
 */
class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEndOfWord = false;
  suggestions: MentionSuggestion[] = [];
}

// Enhanced file-based autocomplete provider
export class FileAutocompleteProvider implements AutocompleteProvider {
  private fileIndex: Map<string, MentionSuggestion> = new Map();
  private lastUpdate = 0;
  private readonly UPDATE_INTERVAL = 30000; // 30 seconds
  
  constructor(private getFiles: () => Promise<Array<{ path: string; lastModified?: Date; gitStatus?: string; size?: number }>>) {}

  getType(): string {
    return 'file';
  }

  async getSuggestions(query: string, context?: MentionContext): Promise<MentionSuggestion[]> {
    const files = await this.getFiles();
    
    const suggestions: MentionSuggestion[] = files.map(file => ({
      type: 'file',
      value: file.path,
      label: file.path,
      description: `File: ${file.path}`,
      icon: this.getFileIcon(file.path),
      metadata: {
        lastModified: file.lastModified
      },
      priority: this.calculatePriority(file, context)
    }));

    // Apply fuzzy search
    const filtered = FuzzySearch.filter(suggestions, query, {
      threshold: 0.2,
      maxResults: 20
    });

    return filtered;
  }

  private getFileIcon(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    
    const iconMap: Record<string, string> = {
      'ts': '🔷',
      'tsx': '⚛️',
      'js': '🟨',
      'jsx': '⚛️',
      'py': '🐍',
      'java': '☕',
      'cpp': '⚙️',
      'c': '⚙️',
      'go': '🐹',
      'rs': '🦀',
      'rb': '💎',
      'php': '🐘',
      'html': '🌐',
      'css': '🎨',
      'json': '📋',
      'md': '📝',
      'txt': '📄'
    };
    
    return iconMap[ext] || '📄';
  }

  private calculatePriority(file: { path: string; lastModified?: Date; gitStatus?: string }, context?: MentionContext): number {
    let priority = 5; // base priority
    
    // Recently modified files get higher priority
    if (file.lastModified) {
      const hoursSinceModified = (Date.now() - file.lastModified.getTime()) / (1000 * 60 * 60);
      if (hoursSinceModified < 1) {priority += 5;}
      else if (hoursSinceModified < 24) {priority += 3;}
      else if (hoursSinceModified < 168) {priority += 1;} // 1 week
    }
    
    // Files with git changes get priority
    if (file.gitStatus && ['M', 'A', 'D'].includes(file.gitStatus)) {
      priority += 4;
    }
    
    // Files currently open get priority
    if (context?.openFiles?.includes(file.path)) {
      priority += 6;
    }
    
    // Current file gets highest priority
    if (context?.currentFile === file.path) {
      priority += 10;
    }
    
    return priority;
  }
}