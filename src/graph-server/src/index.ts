import type { ApiModule } from '@ai-companion/types';
import { TOOLS, handleToolCall } from './tools.js';

const graphServer: ApiModule = {
  name: 'graph-server',
  tools: TOOLS,
  handleToolCall,
};

export default graphServer;
