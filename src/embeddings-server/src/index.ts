import type { ApiModule } from '@ai-companion/types';
import { TOOLS, handleToolCall } from './tools.js';

const embeddingsServer: ApiModule = {
  name: 'embeddings-server',
  tools: TOOLS,
  handleToolCall,
};

export default embeddingsServer;
