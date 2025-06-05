/**
 * Least Recently Used (LRU) Cache implementation for performance optimization
 */
export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;
  private accessOrder: K[];

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Cache capacity must be positive');
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.accessOrder = [];
  }

  /**
   * Gets a value from the cache
   */
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.moveToEnd(key);
    }
    return value;
  }

  /**
   * Sets a value in the cache
   */
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing key
      this.cache.set(key, value);
      this.moveToEnd(key);
    } else {
      // Add new key
      if (this.cache.size >= this.capacity) {
        // Remove least recently used item
        const lruKey = this.accessOrder.shift();
        if (lruKey !== undefined) {
          this.cache.delete(lruKey);
        }
      }
      
      this.cache.set(key, value);
      this.accessOrder.push(key);
    }
  }

  /**
   * Checks if a key exists in the cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Deletes a key from the cache
   */
  delete(key: K): boolean {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      return true;
    }
    return false;
  }

  /**
   * Clears the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Gets the current size of the cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Gets all keys in the cache (in access order)
   */
  keys(): K[] {
    return [...this.accessOrder];
  }

  /**
   * Gets all values in the cache
   */
  values(): V[] {
    return this.accessOrder.map(key => this.cache.get(key)!);
  }

  /**
   * Gets all entries in the cache
   */
  entries(): [K, V][] {
    return this.accessOrder.map(key => [key, this.cache.get(key)!]);
  }

  /**
   * Moves a key to the end of the access order (most recently used)
   */
  private moveToEnd(key: K): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    }
  }

  /**
   * Gets cache statistics
   */
  getStats(): {
    size: number;
    capacity: number;
    hitRate?: number;
    oldestKey?: K;
    newestKey?: K;
  } {
    return {
      size: this.cache.size,
      capacity: this.capacity,
      oldestKey: this.accessOrder[0],
      newestKey: this.accessOrder[this.accessOrder.length - 1]
    };
  }
}

/**
 * TTL (Time To Live) LRU Cache that automatically expires entries
 */
export class TTLCache<K, V> extends LRUCache<K, V> {
  private ttlMap: Map<K, number>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(capacity: number, private ttlMs: number, cleanupIntervalMs = 60000) {
    super(capacity);
    this.ttlMap = new Map();
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }

  /**
   * Gets a value from the cache, checking TTL
   */
  get(key: K): V | undefined {
    const expireTime = this.ttlMap.get(key);
    if (expireTime && Date.now() > expireTime) {
      // Entry has expired
      this.delete(key);
      return undefined;
    }
    return super.get(key);
  }

  /**
   * Sets a value in the cache with TTL
   */
  set(key: K, value: V): void {
    super.set(key, value);
    this.ttlMap.set(key, Date.now() + this.ttlMs);
  }

  /**
   * Deletes a key from the cache
   */
  delete(key: K): boolean {
    this.ttlMap.delete(key);
    return super.delete(key);
  }

  /**
   * Clears the entire cache
   */
  clear(): void {
    super.clear();
    this.ttlMap.clear();
  }

  /**
   * Removes expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: K[] = [];

    for (const [key, expireTime] of this.ttlMap.entries()) {
      if (now > expireTime) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }
  }

  /**
   * Destroys the cache and cleans up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}