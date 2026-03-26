import type { ApiModule } from '@ai-companion/types';
import { TOOLS, handleToolCall } from './tools.js';

const taskServer: ApiModule = {
  name: 'task-server',
  tools: TOOLS,
  handleToolCall,
};

export default taskServer;
