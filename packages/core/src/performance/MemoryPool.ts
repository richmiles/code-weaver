/**
 * Memory pool for efficient object reuse and garbage collection optimization
 */
export class MemoryPool<T> {
  private available: T[] = [];
  private inUse = new Set<T>();
  private factory: () => T;
  private reset?: (item: T) => void;
  private maxSize: number;

  constructor(
    factory: () => T,
    maxSize = 100,
    reset?: (item: T) => void
  ) {
    this.factory = factory;
    this.maxSize = maxSize;
    this.reset = reset;
  }

  /**
   * Acquires an object from the pool
   */
  acquire(): T {
    let item: T;
    
    if (this.available.length > 0) {
      item = this.available.pop()!;
    } else {
      item = this.factory();
    }
    
    this.inUse.add(item);
    return item;
  }

  /**
   * Returns an object to the pool
   */
  release(item: T): void {
    if (!this.inUse.has(item)) {
      return; // Item not from this pool
    }

    this.inUse.delete(item);

    // Reset the item if a reset function is provided
    if (this.reset) {
      this.reset(item);
    }

    // Only keep items if under max size
    if (this.available.length < this.maxSize) {
      this.available.push(item);
    }
  }

  /**
   * Gets pool statistics
   */
  getStats(): {
    available: number;
    inUse: number;
    total: number;
    maxSize: number;
  } {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
      maxSize: this.maxSize
    };
  }

  /**
   * Clears the pool
   */
  clear(): void {
    this.available = [];
    this.inUse.clear();
  }

  /**
   * Pre-fills the pool with objects
   */
  preFill(count: number): void {
    const targetCount = Math.min(count, this.maxSize);
    
    while (this.available.length < targetCount) {
      const item = this.factory();
      if (this.reset) {
        this.reset(item);
      }
      this.available.push(item);
    }
  }
}

/**
 * Buffer pool for efficient buffer management
 */
export class BufferPool {
  private pools = new Map<number, MemoryPool<Buffer>>();
  private readonly commonSizes = [1024, 4096, 16384, 65536, 262144]; // Common buffer sizes

  constructor() {
    // Pre-create pools for common buffer sizes
    for (const size of this.commonSizes) {
      this.pools.set(size, new MemoryPool(
        () => Buffer.allocUnsafe(size),
        20, // Max 20 buffers per size
        (buffer) => buffer.fill(0) // Clear buffer on reset
      ));
    }
  }

  /**
   * Acquires a buffer of the specified size
   */
  acquire(size: number): Buffer {
    // Find the smallest buffer that can accommodate the requested size
    const poolSize = this.commonSizes.find(s => s >= size);
    
    if (poolSize && this.pools.has(poolSize)) {
      const buffer = this.pools.get(poolSize)!.acquire();
      return buffer.slice(0, size); // Return a slice of the requested size
    }

    // For uncommon sizes, just allocate directly
    return Buffer.allocUnsafe(size);
  }

  /**
   * Returns a buffer to the appropriate pool
   */
  release(buffer: Buffer): void {
    const originalSize = buffer.length;
    const poolSize = this.commonSizes.find(s => s === originalSize);
    
    if (poolSize && this.pools.has(poolSize)) {
      this.pools.get(poolSize)!.release(buffer);
    }
    // For non-pooled buffers, just let GC handle them
  }

  /**
   * Gets statistics for all buffer pools
   */
  getStats(): Record<number, ReturnType<MemoryPool<Buffer>['getStats']>> {
    const stats: Record<number, ReturnType<MemoryPool<Buffer>['getStats']>> = {};
    
    for (const [size, pool] of this.pools) {
      stats[size] = pool.getStats();
    }
    
    return stats;
  }

  /**
   * Clears all buffer pools
   */
  clear(): void {
    for (const pool of this.pools.values()) {
      pool.clear();
    }
  }
}

/**
 * String pool for efficient string deduplication
 */
export class StringPool {
  private strings = new Map<string, string>();
  private accessCount = new Map<string, number>();
  private cleanupCounter = 0;
  private readonly cleanupInterval = 1000; // Clean up every 1000 operations
  private readonly maxSize = 10000; // Maximum number of strings to cache

  /**
   * Interns a string (deduplicates it)
   */
  intern(str: string): string {
    // Periodic cleanup of less-used strings
    if (++this.cleanupCounter >= this.cleanupInterval) {
      this.cleanup();
      this.cleanupCounter = 0;
    }

    if (this.strings.has(str)) {
      // Increment access count for existing string
      this.accessCount.set(str, (this.accessCount.get(str) || 0) + 1);
      return this.strings.get(str)!;
    }

    // Add new string if we have room or if this is a frequently accessed one
    if (this.strings.size < this.maxSize) {
      this.strings.set(str, str);
      this.accessCount.set(str, 1);
    }
    
    return str;
  }

  /**
   * Gets the number of unique strings in the pool
   */
  size(): number {
    return this.strings.size;
  }

  /**
   * Cleans up least recently used strings when at capacity
   */
  private cleanup(): void {
    if (this.strings.size <= this.maxSize * 0.8) {
      return; // Only cleanup when we're near capacity
    }

    // Sort by access count and remove least accessed
    const entries = Array.from(this.accessCount.entries());
    entries.sort((a, b) => a[1] - b[1]); // Sort by access count ascending
    
    const toDelete = entries.slice(0, Math.floor(this.maxSize * 0.2)); // Remove 20% least accessed
    
    for (const [key] of toDelete) {
      this.strings.delete(key);
      this.accessCount.delete(key);
    }
  }

  /**
   * Manually clears the string pool
   */
  clear(): void {
    this.strings.clear();
    this.accessCount.clear();
  }
}