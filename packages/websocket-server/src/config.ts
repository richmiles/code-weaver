// packages/websocket-server/src/config.ts
import { ServerConfig, DEFAULT_CONFIG } from './types';

/**
 * Configuration manager for the WebSocket server
 * Handles loading, validating, and providing access to configuration values
 */
export class ConfigManager {
  private config: ServerConfig;

  constructor(userConfig: Partial<ServerConfig> = {}) {
    // Merge default config with user-provided config
    this.config = {
      ...DEFAULT_CONFIG,
      ...userConfig
    };
    
    this.validateConfig();
  }

  /**
   * Validate configuration values
   */
  private validateConfig(): void {
    // Validate port
    if (this.config.port <= 0 || this.config.port > 65535) {
      throw new Error(`Invalid port number: ${this.config.port}. Port must be between 1 and 65535.`);
    }

    // Validate ping interval
    if (this.config.pingInterval !== undefined && this.config.pingInterval < 1000) {
      throw new Error(`Invalid ping interval: ${this.config.pingInterval}. Interval must be at least 1000ms.`);
    }
  }

  /**
   * Get the complete configuration
   */
  public getConfig(): ServerConfig {
    return { ...this.config };
  }

  /**
   * Get a specific configuration value
   */
  public get<K extends keyof ServerConfig>(key: K): ServerConfig[K] {
    return this.config[key];
  }

  /**
   * Update a specific configuration value
   */
  public update<K extends keyof ServerConfig>(key: K, value: ServerConfig[K]): void {
    this.config[key] = value;
    this.validateConfig();
  }
}

export function parseConfig(userConfig: Partial<ServerConfig> = {}): ServerConfig {
  const manager = new ConfigManager(userConfig);
  return manager.getConfig();
}

export default ConfigManager;