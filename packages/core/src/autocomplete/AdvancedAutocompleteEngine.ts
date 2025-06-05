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

export interface AutocompleteOptions {
  maxSuggestions?: number;
  cacheSize?: number;
  cacheTTL?: number;
  enableFuzzySearch?: boolean;
  fuzzyThreshold?: number;
}

/**
 * Trie node for efficient prefix searching
 */
class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEndOfWord = false;
  suggestions: MentionSuggestion[] = [];
}

export class FuzzySearch {
  private static readonly DEFAULT_OPTIONS: FuzzySearchOptions = {
    threshold: 0.3,
    maxResults: 50,
    caseSensitive: false
  };

  /**
   * Calculate fuzzy search score between query and target
   * Uses a sophisticated scoring algorithm with multiple factors
   */
  static score(query: string, target: string, options: Partial<FuzzySearchOptions> = {}): number {
    const opts = { ...FuzzySearch.DEFAULT_OPTIONS, ...options };
    
    if (!query) return 1; // empty query matches everything
    if (!target) return 0;
    
    const q = opts.caseSensitive ? query : query.toLowerCase();
    const t = opts.caseSensitive ? target : target.toLowerCase();
    
    // Exact match gets perfect score
    if (t === q) return 1.0;
    
    // Exact substring match gets high score
    if (t.includes(q)) {
      const startIndex = t.indexOf(q);
      const lengthRatio = q.length / t.length;
      const positionBonus = 1 - (startIndex / t.length) * 0.3; // earlier matches get bonus
      return 0.7 + lengthRatio * 0.2 + positionBonus * 0.1;
    }
    
    // Character-by-character fuzzy matching with advanced scoring
    let queryIndex = 0;
    let matches = 0;
    let consecutiveMatches = 0;
    let maxConsecutive = 0;
    let wordBoundaryMatches = 0;
    
    for (let targetIndex = 0; targetIndex < t.length && queryIndex < q.length; targetIndex++) {
      if (t[targetIndex] === q[queryIndex]) {
        matches++;
        queryIndex++;
        consecutiveMatches++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
        
        // Bonus for matches at word boundaries
        if (targetIndex === 0 || t[targetIndex - 1] === ' ' || t[targetIndex - 1] === '_' || t[targetIndex - 1] === '-') {
          wordBoundaryMatches++;
        }
      } else {
        consecutiveMatches = 0;
      }
    }
    
    // Didn't match all characters
    if (queryIndex < q.length) {
      return 0;
    }
    
    // Calculate comprehensive score
    const matchRatio = matches / Math.max(q.length, t.length);
    const consecutiveBonus = maxConsecutive / q.length * 0.3;
    const wordBoundaryBonus = wordBoundaryMatches / q.length * 0.2;
    const lengthPenalty = Math.abs(t.length - q.length) / Math.max(t.length, q.length) * 0.1;
    
    return Math.min(matchRatio + consecutiveBonus + wordBoundaryBonus - lengthPenalty, 0.65);
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

export class AdvancedAutocompleteEngine {
  private providers: Map<string, AutocompleteProvider> = new Map();
  private cache: LRUCache<string, { suggestions: MentionSuggestion[]; timestamp: number }>;
  private readonly CACHE_TTL: number;
  private readonly options: Required<AutocompleteOptions>;
  private indexCache: Map<string, TrieNode> = new Map();
  private usageStats: Map<string, { count: number; lastUsed: number }> = new Map();
  
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
    // Invalidate cache for this provider type
    this.invalidateCache(provider.getType());
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
      return this.applyUsageStats(cached.suggestions).slice(0, this.options.maxSuggestions);
    }

    const provider = this.providers.get(mentionType);
    if (!provider) {
      return [];
    }

    try {
      let suggestions = await provider.getSuggestions(query, context);
      
      // Apply intelligent filtering and ranking
      suggestions = this.rankSuggestions(suggestions, query, context);
      
      // Apply usage statistics
      suggestions = this.applyUsageStats(suggestions);
      
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

    // Flatten and deduplicate by value
    const merged = new Map<string, MentionSuggestion>();
    
    for (const suggestions of allSuggestions) {
      for (const suggestion of suggestions) {
        const existing = merged.get(suggestion.value);
        if (!existing || (suggestion.priority || 0) > (existing.priority || 0)) {
          merged.set(suggestion.value, suggestion);
        }
      }
    }

    // Sort by priority and fuzzy score
    const sorted = Array.from(merged.values()).sort((a, b) => {
      // Priority first
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by fuzzy search score
      const scoreA = FuzzySearch.score(query, a.label);
      const scoreB = FuzzySearch.score(query, b.label);
      return scoreB - scoreA;
    });

    return sorted.slice(0, this.options.maxSuggestions);
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
   * Record usage of a suggestion for learning user preferences
   */
  recordUsage(suggestion: MentionSuggestion): void {
    const key = `${suggestion.type}:${suggestion.value}`;
    const current = this.usageStats.get(key) || { count: 0, lastUsed: 0 };
    
    this.usageStats.set(key, {
      count: current.count + 1,
      lastUsed: Date.now()
    });
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
   * Apply usage statistics to boost frequently used suggestions
   */
  private applyUsageStats(suggestions: MentionSuggestion[]): MentionSuggestion[] {
    return suggestions.map(suggestion => {
      const key = `${suggestion.type}:${suggestion.value}`;
      const stats = this.usageStats.get(key);
      
      if (stats) {
        // Calculate recency bonus (more recent = higher bonus)
        const daysSinceUsed = (Date.now() - stats.lastUsed) / (1000 * 60 * 60 * 24);
        const recencyBonus = Math.max(0, 5 - daysSinceUsed);
        
        // Calculate frequency bonus
        const frequencyBonus = Math.min(stats.count * 0.5, 5);
        
        return {
          ...suggestion,
          priority: (suggestion.priority || 0) + recencyBonus + frequencyBonus
        };
      }
      
      return suggestion;
    });
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
   * Clear all cached suggestions and usage stats
   */
  clearCache(): void {
    this.cache.clear();
    this.indexCache.clear();
    this.usageStats.clear();
  }
  
  /**
   * Get autocomplete statistics
   */
  getStats(): {
    cacheSize: number;
    providersCount: number;
    indexedTypes: string[];
    usageStatsCount: number;
  } {
    return {
      cacheSize: this.cache.size(),
      providersCount: this.providers.size,
      indexedTypes: Array.from(this.indexCache.keys()),
      usageStatsCount: this.usageStats.size
    };
  }

  /**
   * Export usage statistics for persistence
   */
  exportUsageStats(): Record<string, { count: number; lastUsed: number }> {
    return Object.fromEntries(this.usageStats);
  }

  /**
   * Import usage statistics from persistence
   */
  importUsageStats(stats: Record<string, { count: number; lastUsed: number }>): void {
    this.usageStats.clear();
    for (const [key, value] of Object.entries(stats)) {
      this.usageStats.set(key, value);
    }
  }
}