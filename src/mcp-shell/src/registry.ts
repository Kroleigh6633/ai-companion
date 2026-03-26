import type { Tool } from '@modelcontextprotocol/sdk/types.js';
export type { ApiModule } from '@ai-companion/types';
import type { ApiModule } from '@ai-companion/types';

export class ServerRegistry {
  private modules = new Map<string, ApiModule>();

  register(mod: ApiModule): void {
    this.modules.set(mod.name, mod);
  }

  unregister(name: string): void {
    this.modules.delete(name);
  }

  getAll(): ApiModule[] {
    return Array.from(this.modules.values());
  }

  getAllTools(): Tool[] {
    return this.getAll().flatMap((m) => m.tools);
  }

  findModule(toolName: string): ApiModule | undefined {
    return this.getAll().find((m) => m.tools.some((t) => t.name === toolName));
  }
}
