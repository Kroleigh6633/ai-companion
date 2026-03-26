import { describe, it, expect, vi } from 'vitest';
import { ServerRegistry } from './registry.js';
import { ToolRouter } from './router.js';

describe('ServerRegistry', () => {
  it('registers and retrieves modules', () => {
    const registry = new ServerRegistry();
    const mod = {
      name: 'test-server',
      tools: [{ name: 'test_tool', description: 'A test tool', inputSchema: { type: 'object' as const, properties: {} } }],
      handleToolCall: vi.fn(),
    };
    registry.register(mod);
    expect(registry.getAllTools()).toHaveLength(1);
    expect(registry.getAllTools()[0].name).toBe('test_tool');
  });

  it('unregisters modules', () => {
    const registry = new ServerRegistry();
    registry.register({
      name: 'temp',
      tools: [{ name: 'temp_tool', description: 'temp', inputSchema: { type: 'object' as const, properties: {} } }],
      handleToolCall: vi.fn(),
    });
    registry.unregister('temp');
    expect(registry.getAllTools()).toHaveLength(0);
  });

  it('finds module by tool name', () => {
    const registry = new ServerRegistry();
    registry.register({
      name: 'my-server',
      tools: [{ name: 'my_tool', description: 'tool', inputSchema: { type: 'object' as const, properties: {} } }],
      handleToolCall: vi.fn(),
    });
    expect(registry.findModule('my_tool')?.name).toBe('my-server');
    expect(registry.findModule('unknown')).toBeUndefined();
  });
});

describe('ToolRouter', () => {
  it('routes to correct module', async () => {
    const registry = new ServerRegistry();
    const handler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    registry.register({
      name: 'svc',
      tools: [{ name: 'do_thing', description: '', inputSchema: { type: 'object' as const, properties: {} } }],
      handleToolCall: handler,
    });
    const router = new ToolRouter(registry);
    const result = await router.route('do_thing', { x: 1 });
    expect(handler).toHaveBeenCalledWith('do_thing', { x: 1 });
    expect(result.isError).toBeFalsy();
  });

  it('returns error for unknown tool', async () => {
    const router = new ToolRouter(new ServerRegistry());
    const result = await router.route('nonexistent', {});
    expect(result.isError).toBe(true);
  });
});
