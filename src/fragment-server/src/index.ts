import type { ApiModule } from '@ai-companion/types';
import { TOOLS, handleToolCall } from './tools.js';

const fragmentServer: ApiModule = {
  name: 'fragment-server',
  tools: TOOLS,
  handleToolCall,
};

export default fragmentServer;
