export interface SizeMetrics {
  characters: number;
  lines: number;
  bytes: number;
  estimatedTokens: number; // Rough token estimate for LLMs
  wordCount?: number;
}

export interface BudgetLimits {
  maxCharacters?: number;
  maxTokens?: number;
  maxBytes?: number;
  warningThreshold?: number; // Percentage (0-100) to warn at
}

export interface SizeBudget {
  current: SizeMetrics;
  limits: BudgetLimits;
  remainingTokens: number;
  utilizationPercent: number;
  isOverBudget: boolean;
}