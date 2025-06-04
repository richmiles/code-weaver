import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { WebSocketClient } from "@codeweaver/websocket-client";
import { ContextSource, FileSource, SourceType } from "@codeweaver/core";

// Configuration
const WS_SERVER_URL = process.env.CODEWEAVER_WS_URL || "ws://localhost:8180";

// Global WebSocket client
let wsClient: WebSocketClient | null = null;

// Helper function to ensure WebSocket connection
async function ensureConnection(): Promise<WebSocketClient> {
  if (!wsClient) {
    wsClient = new WebSocketClient(WS_SERVER_URL, {
      autoReconnect: true,
      events: {
        onConnect: () => console.error("Connected to CodeWeaver WebSocket server"),
        onDisconnect: () => console.error("Disconnected from CodeWeaver WebSocket server"),
        onError: (error) => console.error("WebSocket error:", error)
      }
    });
    
    await wsClient.connect();
  }
  
  if (!wsClient.isActive()) {
    await wsClient.connect();
  }
  
  return wsClient;
}

// Create server instance
const server = new McpServer({
  name: "codeweaver",
  version: "1.0.0",
});

// List all context sources
server.tool(
  "list-sources",
  "List all available context sources",
  {},
  async () => {
    try {
      const client = await ensureConnection();
      const sources = await client.getSources();
      
      const sourcesList = sources.map(source => {
        const metadata = {
          id: source.id,
          type: source.type,
          label: source.label,
          description: source.description,
          created: source.createdAt.toISOString()
        };
        
        if (source.type === SourceType.FILE) {
          const fileSource = source as FileSource;
          return {
            ...metadata,
            filePath: fileSource.filePath,
            size: fileSource.fileMetadata?.size
          };
        }
        
        return metadata;
      });

      return {
        content: [
          {
            type: "text",
            text: `Available context sources (${sources.length}):\n\n${JSON.stringify(sourcesList, null, 2)}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error listing sources: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
);

// Get active context
server.tool(
  "get-active-context",
  "Get the current active context with content",
  {},
  async () => {
    try {
      const client = await ensureConnection();
      const activeSourceIds = await client.getActiveContext();
      const allSources = await client.getSources();
      
      const activeSources = allSources.filter(source => activeSourceIds.includes(source.id));
      
      if (activeSources.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No active context sources"
            }
          ]
        };
      }

      const contextData = [];
      
      for (const source of activeSources) {
        try {
          const content = await client.getSourceContent(source.id);
          const header = source.type === SourceType.FILE 
            ? `## File: ${(source as FileSource).filePath}`
            : `## ${source.type}: ${source.label}`;
          
          contextData.push(`${header}\n\n\`\`\`\n${content}\n\`\`\``);
        } catch (error) {
          contextData.push(`## ${source.label}\nError loading content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `Active Context (${activeSources.length} sources):\n\n${contextData.join('\n\n')}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting active context: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
);

// Add file to context
server.tool(
  "add-file-source",
  "Add a file to the context sources",
  {
    filePath: z.string().describe("Path to the file to add"),
    label: z.string().optional().describe("Optional label for the file source")
  },
  async ({ filePath, label }) => {
    try {
      const client = await ensureConnection();
      
      const fileSource = {
        type: SourceType.FILE,
        label: label || filePath.split('/').pop() || filePath,
        filePath: filePath,
        description: `File: ${filePath}`,
        fileMetadata: {
          size: 0, // Will be populated by server
          lastModified: new Date()
        }
      };

      const addedSource = await client.addSource(fileSource);
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully added file source: ${addedSource.label} (ID: ${addedSource.id})`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error adding file source: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
);

// Set active context
server.tool(
  "set-active-context",
  "Set which sources are active in the context",
  {
    sourceIds: z.array(z.string()).describe("Array of source IDs to activate")
  },
  async ({ sourceIds }) => {
    try {
      const client = await ensureConnection();
      await client.setActiveContext(sourceIds);
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully activated ${sourceIds.length} sources`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting active context: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
);

// Browse directory
server.tool(
  "browse-directory",
  "Browse files and directories in the workspace",
  {
    path: z.string().optional().describe("Directory path to browse (relative to workspace root)")
  },
  async ({ path }) => {
    try {
      const client = await ensureConnection();
      const result = await client.browseDirectory(path);
      
      const items = result.items.map(item => ({
        name: item.name,
        path: item.path,
        type: item.isDirectory ? 'directory' : 'file',
        size: item.size,
        lastModified: item.lastModified?.toISOString()
      }));

      return {
        content: [
          {
            type: "text",
            text: `Directory: /${result.path}\n\n${JSON.stringify(items, null, 2)}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error browsing directory: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
);

// Get file content
server.tool(
  "get-file-content",
  "Get the content of a specific source",
  {
    sourceId: z.string().describe("ID of the source to get content for")
  },
  async ({ sourceId }) => {
    try {
      const client = await ensureConnection();
      const content = await client.getSourceContent(sourceId);
      
      return {
        content: [
          {
            type: "text",
            text: content
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting file content: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CodeWeaver MCP Server running on stdio");
  console.error(`Connecting to WebSocket server at: ${WS_SERVER_URL}`);
}

// Cleanup on exit
process.on('SIGINT', () => {
  if (wsClient) {
    wsClient.disconnect();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (wsClient) {
    wsClient.disconnect();
  }
  process.exit(0);
});

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});