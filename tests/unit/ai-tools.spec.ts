import { test, expect } from '@playwright/test';

const HARNESS = '/tests/fixtures/neptune-harness.html';

test.describe('AiChat tool calling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
  });

  test('generateWithTools rejects non-LiteRT models', async ({ page }) => {
    const message = await page.evaluate(async () => {
      const { AiChat, TOOLS_UNSUPPORTED_ERROR } = await import('/ai-chat.js');
      const chat = new AiChat({ modelId: 'Qwen3-0.6B-q4f16_1-MLC' });
      chat.registerTools([{ name: 'ping', description: 'ping', parameters: { type: 'object' } }]);
      chat._isLoaded = true;
      chat.engine = {};
      try {
        await chat.generateWithTools('hi', { execute: async () => ({}) });
        return 'expected-throw';
      } catch (err) {
        return err?.message || String(err);
      }
    });
    expect(message).toMatch(/Tool calling is only supported|TOOLS_UNSUPPORTED/i);
  });

  test('generateWithTools XML loop executes allowlisted tool then returns final reply', async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const { AiChat } = await import('/ai-chat.js');
      const chat = new AiChat({
        modelId: 'gemma-4-E2B-it-web',
        toolProtocol: 'xml',
        systemPromptOptions: { product: 'Labs Test' },
      });
      chat.registerTools([
        {
          name: 'search_curriculum',
          description: 'Search lessons',
          parameters: { type: 'object', properties: { query: { type: 'string' } } },
        },
      ]);
      chat._isLoaded = true;
      chat.engine = {
        createConversation: async () => ({
          sendMessage: async () => ({ content: 'unused' }),
        }),
      };
      chat._nativeToolsSupported = false;

      const scripted = [
        '<tool_call name="search_curriculum">{"query":"narrowing"}</tool_call>',
        'Narrowing is covered in the types track.',
      ];
      let i = 0;
      chat._completeOnceLiteRTDetailed = async () => {
        const reply = scripted[Math.min(i, scripted.length - 1)];
        i += 1;
        return { reply, usage: null, rawMessage: { content: reply } };
      };

      const calls = [];
      const final = await chat.generateWithTools('Where is narrowing taught?', {
        maxRounds: 3,
        execute: async (name, args) => {
          calls.push({ name, args });
          return { hits: [{ id: 'in-operator-narrowing', title: 'in operator narrowing' }] };
        },
      });
      return { final, calls, messageRoles: chat.messages.map((m) => m.role) };
    });

    expect(result.calls).toEqual([{ name: 'search_curriculum', args: { query: 'narrowing' } }]);
    expect(result.final).toContain('Narrowing is covered');
    expect(result.messageRoles[0]).toBe('user');
    expect(result.messageRoles).toContain('assistant');
  });

  test('generateWithTools blocks unknown tool names before execute', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { AiChat } = await import('/ai-chat.js');
      const chat = new AiChat({ modelId: 'gemma-4-E2B-it-web', toolProtocol: 'xml' });
      chat.registerTools([{ name: 'search_curriculum', parameters: { type: 'object' } }]);
      chat._isLoaded = true;
      chat.engine = { createConversation: async () => ({}) };
      let executed = false;
      const scripted = [
        '<tool_call name="delete_everything">{}</tool_call>',
        'I cannot do that.',
      ];
      let i = 0;
      chat._completeOnceLiteRTDetailed = async () => {
        const reply = scripted[i++];
        return { reply, usage: null, rawMessage: { content: reply } };
      };
      const onTool = [];
      const final = await chat.generateWithTools('Wipe disk', {
        execute: async () => {
          executed = true;
          return {};
        },
        onTool: (info) => onTool.push(info),
      });
      return { final, executed, onTool };
    });
    expect(result.executed).toBe(false);
    expect(result.onTool[0]?.result?.error).toBe('tool.name.not_allowed');
    expect(result.final).toContain('cannot');
  });

  test('generateWithTools stops at maxRounds', async ({ page }) => {
    const message = await page.evaluate(async () => {
      const { AiChat } = await import('/ai-chat.js');
      const chat = new AiChat({ modelId: 'gemma-4-E2B-it-web', toolProtocol: 'xml' });
      chat.registerTools([{ name: 'ping', parameters: { type: 'object' } }]);
      chat._isLoaded = true;
      chat.engine = { createConversation: async () => ({}) };
      chat._completeOnceLiteRTDetailed = async () => ({
        reply: '<tool_call name="ping">{}</tool_call>',
        usage: null,
        rawMessage: {},
      });
      try {
        await chat.generateWithTools('loop', {
          maxRounds: 2,
          execute: async () => ({ ok: true }),
        });
        return 'expected-throw';
      } catch (err) {
        return err?.message || String(err);
      }
    });
    expect(message).toMatch(/maxRounds/i);
  });
});
