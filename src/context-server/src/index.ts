import type { ApiModule } from '@ai-companion/types';
import { TOOLS, handleToolCall } from './tools.js';

const contextServer: ApiModule = {
  name: 'context-server',
  tools: TOOLS,
  handleToolCall,
};

export default contextServer;
