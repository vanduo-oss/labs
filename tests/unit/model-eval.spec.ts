import { test, expect } from '@playwright/test';

test.describe('vdl-model-eval scorers', () => {
  test('branding / honesty / instruction scorers and concurrency planner', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const mod = await import('/model-eval.js');
      const brandingPass = mod.scoreBranding(
        'This is the Vanduo Labs site in the vanduo-oss organization.',
      );
      const brandingFail = mod.scoreBranding(
        'Welcome to Vandouno Labs, part of vanduo-oss.',
      );
      const honestyPass = mod.scoreHonesty(
        'False. Vanduo Labs is open source under vanduo-oss on GitHub.',
      );
      const honestyFail = mod.scoreHonesty(
        'True — it is a closed-source OpenAI product.',
      );
      const instructionPass = mod.scoreInstructionExact('blue quiet river', {
        exactNormalized: 'blue quiet river',
      });
      const instructionFail = mod.scoreInstructionExact('blue quiet river!', {
        exactNormalized: 'blue quiet river',
      });
      const plan = mod.planConcurrency(
        [
          { id: 'qwen3-0.6B-litert', approxBytes: 0.6 * 1024 ** 3 },
          { id: 'gemma-4-E2B-it-web', approxBytes: 2.0 * 1024 ** 3 },
        ],
        { deviceMemoryGb: 24, budgetFraction: 0.45, maxConcurrent: 3 },
      );
      const report = mod.buildReportDocument({
        suiteName: 't',
        suiteVersion: '0',
        modelResults: [
          mod.summarizeModelResults(
            { modelId: 'x', family: 'gemma4', backend: 'litert' },
            [{ id: 'a', pass: true, reasons: ['ok'], latencyMs: 10 }],
          ),
        ],
      });
      const html = mod.renderReportHtml(report);
      return {
        brandingPass: brandingPass.pass,
        brandingFail: brandingFail.pass,
        honestyPass: honestyPass.pass,
        honestyFail: honestyFail.pass,
        instructionPass: instructionPass.pass,
        instructionFail: instructionFail.pass,
        waves: plan.waves,
        htmlHasPass: html.includes('PASS'),
        htmlLightTheme:
          html.includes('color-scheme: light') &&
          html.includes('--vdl-report-fg:') &&
          !html.includes('color-scheme: light dark'),
        version: mod.VDL_MODEL_EVAL_VERSION,
      };
    });

    expect(result.brandingPass).toBe(true);
    expect(result.brandingFail).toBe(false);
    expect(result.honestyPass).toBe(true);
    expect(result.honestyFail).toBe(false);
    expect(result.instructionPass).toBe(true);
    expect(result.instructionFail).toBe(false);
    expect(result.waves).toEqual([['qwen3-0.6B-litert', 'gemma-4-E2B-it-web']]);
    expect(result.htmlHasPass).toBe(true);
    expect(result.htmlLightTheme).toBe(true);
    expect(result.version).toBe('0.0.1');
  });
});
