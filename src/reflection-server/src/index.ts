import type { ApiModule } from '@ai-companion/types';
import { TOOLS, handleToolCall } from './tools.js';

const reflectionServer: ApiModule = {
  name: 'reflection-server',
  tools: TOOLS,
  handleToolCall,
};

export default reflectionServer;
