// Minimal MCP type definitions — avoids pulling @modelcontextprotocol/sdk
// into runtime dependencies of every server package.

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  [key: string]: unknown;
}

export interface McpCallToolResult {
  content: McpContent[];
  isError?: boolean;
}

export interface ApiModule {
  name: string;
  tools: McpTool[];
  handleToolCall(name: string, args: Record<string, unknown>): Promise<McpCallToolResult>;
}
