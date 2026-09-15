import { test, expect } from '@playwright/test';

const HARNESS = '/tests/fixtures/neptune-harness.html';

test.describe('tiny planner (fast planner experiment)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
  });

  test('generatePlan delegates to the injected chat and stays planning-only', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { createTinyDrawPlanner, TINY_PLANNER_FLAG_KEY } =
        await import('/src/demos/draw-planner-webllm.js');
      const calls = [];
      let disposed = false;
      const planner = createTinyDrawPlanner({
        createChat: async () => ({
          load: async () => {
            calls.push('load');
          },
          reset: () => {
            calls.push('reset');
          },
          isLoaded: () => true,
          generate: async (prompt) => {
            calls.push(`generate:${prompt.slice(0, 12)}`);
            return '{"title":"plan","clear":false,"steps":[]}';
          },
          dispose: async () => {
            disposed = true;
          },
        }),
      });

      const promptOne = 'You are the 2D SVG Canvas Composer…';
      const promptTwo = 'Second planning prompt';
      const first = await planner.generatePlan(promptOne);
      const second = await planner.generatePlan(promptTwo);
      await planner.dispose();

      return {
        id: planner.id,
        first,
        second,
        calls,
        disposed,
        flagKey: TINY_PLANNER_FLAG_KEY,
        expectedCalls: [
          'load',
          'reset',
          `generate:${promptOne.slice(0, 12)}`,
          'reset',
          `generate:${promptTwo.slice(0, 12)}`,
        ],
      };
    });

    expect(res.id).toBe('Qwen3-0.6B-q4f16_1-MLC');
    expect(res.flagKey).toBe('vdl-ai-draw-tiny-planner');
    // One load, then cached chat instance for subsequent turns.
    expect(res.calls).toEqual(res.expectedCalls);
    expect(res.first).toContain('"steps"');
    expect(res.second).toContain('"steps"');
    expect(res.disposed).toBe(true);
  });

  test('load failure disables the planner for the session and reports via onFail', async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const { createTinyDrawPlanner } = await import('/src/demos/draw-planner-webllm.js');
      const failures = [];
      let constructions = 0;
      const planner = createTinyDrawPlanner({
        onFail: (message) => failures.push(message),
        createChat: async () => {
          constructions += 1;
          throw new Error('WebLLM boom');
        },
      });

      const first = await planner.generatePlan('prompt one');
      const second = await planner.generatePlan('prompt two');
      planner.disable();

      return { first, second, failures, constructions, disabled: planner.disabled };
    });

    expect(res.first).toBeNull();
    expect(res.second).toBeNull();
    expect(res.constructions).toBe(1);
    expect(res.disabled).toBe(true);
    expect(res.failures).toHaveLength(1);
    expect(res.failures[0]).toMatch(/Fast planner unavailable/i);
  });

  test('generate failure after load also degrades to null without throwing', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { createTinyDrawPlanner } = await import('/src/demos/draw-planner-webllm.js');
      const failures = [];
      const planner = createTinyDrawPlanner({
        onFail: (message) => failures.push(message),
        createChat: async () => ({
          load: async () => {},
          isLoaded: () => true,
          generate: async () => {
            throw new Error('generate exploded');
          },
        }),
      });

      const out = await planner.generatePlan('prompt');
      const after = planner.disabled;

      return { out, after, failures };
    });

    expect(res.out).toBeNull();
    expect(res.after).toBe(true);
    expect(res.failures[0]).toMatch(/Fast planner failed/i);
  });

  test('flag helpers read and write localStorage safely', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { readTinyPlannerFlag, writeTinyPlannerFlag } =
        await import('/src/demos/draw-planner-webllm.js');
      const before = readTinyPlannerFlag();
      writeTinyPlannerFlag(true);
      const on = readTinyPlannerFlag();
      writeTinyPlannerFlag(false);
      const off = readTinyPlannerFlag();
      return { before, on, off };
    });

    expect(res.before).toBe(false);
    expect(res.on).toBe(true);
    expect(res.off).toBe(false);
  });
});
