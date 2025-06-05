import { Readable, Transform, Writable } from 'stream';
import { pipeline } from 'stream/promises';

/**
 * Stream-based file processor for handling large files efficiently
 */
export class StreamProcessor {
  /**
   * Processes a large file in chunks to avoid memory issues
   */
  static async processLargeFile<T>(
    filePath: string,
    processor: (chunk: Buffer) => T | Promise<T>,
    options: {
      highWaterMark?: number;
      encoding?: BufferEncoding;
      chunkSize?: number;
    } = {}
  ): Promise<T[]> {
    const results: T[] = [];
    const { highWaterMark = 64 * 1024 } = options; // 64KB default

    const transform = new Transform({
      objectMode: true,
      highWaterMark,
      async transform(chunk: Buffer, _encoding, callback) {
        try {
          const result = await processor(chunk);
          results.push(result);
          callback();
        } catch (error) {
          callback(error instanceof Error ? error : new Error(String(error)));
        }
      }
    });

    const fs = await import('fs');
    const readable = fs.createReadStream(filePath, { highWaterMark });
    
    await pipeline(readable, transform);
    
    return results;
  }

  /**
   * Streams directory tree traversal to avoid loading entire tree in memory
   */
  static async* streamDirectoryTree(
    rootPath: string,
    options: {
      maxDepth?: number;
      includeHidden?: boolean;
      filter?: (path: string, isDirectory: boolean) => boolean;
    } = {}
  ): AsyncGenerator<{ path: string; isDirectory: boolean; size?: number; lastModified?: Date }> {
    const { maxDepth = 10, includeHidden = false, filter } = options;
    const fs = await import('fs/promises');
    const path = await import('path');

    async function* traverse(currentPath: string, depth: number): AsyncGenerator<any> {
      if (depth > maxDepth) return;

      try {
        const stats = await fs.stat(currentPath);
        
        if (!includeHidden && path.basename(currentPath).startsWith('.')) {
          return;
        }

        const item = {
          path: currentPath,
          isDirectory: stats.isDirectory(),
          size: stats.isFile() ? stats.size : undefined,
          lastModified: stats.mtime
        };

        if (!filter || filter(currentPath, stats.isDirectory())) {
          yield item;
        }

        if (stats.isDirectory()) {
          try {
            const entries = await fs.readdir(currentPath);
            
            for (const entry of entries) {
              const entryPath = path.join(currentPath, entry);
              yield* traverse(entryPath, depth + 1);
            }
          } catch (error) {
            // Skip directories we can't read
            console.warn(`Cannot read directory ${currentPath}:`, error);
          }
        }
      } catch (error) {
        // Skip files/directories we can't access
        console.warn(`Cannot access ${currentPath}:`, error);
      }
    }

    yield* traverse(rootPath, 0);
  }

  /**
   * Searches files using streaming to handle large result sets
   */
  static async* streamFileSearch(
    rootPath: string,
    query: string,
    options: {
      maxResults?: number;
      includeDirectories?: boolean;
      includeHidden?: boolean;
      caseSensitive?: boolean;
    } = {}
  ): AsyncGenerator<{ path: string; name: string; isDirectory: boolean; score: number }> {
    const { 
      maxResults = 1000, 
      includeDirectories = true, 
      includeHidden = false,
      caseSensitive = false 
    } = options;
    
    const path = await import('path');
    const searchQuery = caseSensitive ? query : query.toLowerCase();
    let resultCount = 0;

    const scorer = (filename: string): number => {
      const name = caseSensitive ? filename : filename.toLowerCase();
      
      if (name === searchQuery) return 100;
      if (name.startsWith(searchQuery)) return 80;
      if (name.includes(searchQuery)) return 60;
      
      // Fuzzy matching score
      let score = 0;
      let queryIndex = 0;
      
      for (let i = 0; i < name.length && queryIndex < searchQuery.length; i++) {
        if (name[i] === searchQuery[queryIndex]) {
          score += 1;
          queryIndex++;
        }
      }
      
      return queryIndex === searchQuery.length ? (score / name.length) * 40 : 0;
    };

    for await (const item of this.streamDirectoryTree(rootPath, { includeHidden })) {
      if (resultCount >= maxResults) break;
      
      if (!includeDirectories && item.isDirectory) continue;
      
      const filename = path.basename(item.path);
      const score = scorer(filename);
      
      if (score > 0) {
        yield {
          path: item.path,
          name: filename,
          isDirectory: item.isDirectory,
          score
        };
        resultCount++;
      }
    }
  }

  /**
   * Processes text content in chunks for large files
   */
  static async processTextContent(
    content: string | Buffer,
    processor: (line: string, lineNumber: number) => void | Promise<void>,
    options: {
      encoding?: BufferEncoding;
      chunkSize?: number;
    } = {}
  ): Promise<void> {
    const { encoding = 'utf8', chunkSize = 64 * 1024 } = options;
    
    let text: string;
    if (Buffer.isBuffer(content)) {
      text = content.toString(encoding);
    } else {
      text = content;
    }

    // Process in chunks to avoid blocking the event loop for very large files
    const lines = text.split('\n');
    let lineNumber = 0;

    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, Math.min(i + chunkSize, lines.length));
      
      for (const line of chunk) {
        await processor(line, lineNumber++);
      }

      // Yield control back to the event loop
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  /**
   * Batches operations to improve performance
   */
  static async batchProcess<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize = 100
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, Math.min(i + batchSize, items.length));
      const batchResults = await processor(batch);
      results.push(...batchResults);
      
      // Yield control back to the event loop between batches
      await new Promise(resolve => setImmediate(resolve));
    }
    
    return results;
  }

  /**
   * Creates a backpressure-aware transform stream
   */
  static createBackpressureTransform<T, R>(
    transform: (chunk: T) => R | Promise<R>,
    options: {
      objectMode?: boolean;
      highWaterMark?: number;
    } = {}
  ): Transform {
    const { objectMode = true, highWaterMark = 16 } = options;
    
    return new Transform({
      objectMode,
      highWaterMark,
      async transform(chunk: T, _encoding, callback) {
        try {
          const result = await transform(chunk);
          this.push(result);
          callback();
        } catch (error) {
          callback(error instanceof Error ? error : new Error(String(error)));
        }
      }
    });
  }

  /**
   * Creates a rate-limited transform stream
   */
  static createRateLimitedTransform<T>(
    rateLimit: number, // Operations per second
    options: {
      objectMode?: boolean;
      highWaterMark?: number;
    } = {}
  ): Transform {
    const { objectMode = true, highWaterMark = 16 } = options;
    const interval = 1000 / rateLimit;
    let lastProcessTime = 0;
    
    return new Transform({
      objectMode,
      highWaterMark,
      async transform(chunk: T, _encoding, callback) {
        const now = Date.now();
        const timeSinceLastProcess = now - lastProcessTime;
        
        if (timeSinceLastProcess < interval) {
          // Wait to respect rate limit
          await new Promise(resolve => 
            setTimeout(resolve, interval - timeSinceLastProcess)
          );
        }
        
        lastProcessTime = Date.now();
        this.push(chunk);
        callback();
      }
    });
  }
}