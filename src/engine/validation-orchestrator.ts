import { AlignBlock, BlockValidationResult, StepValidationResult } from './types';
import { validateStepLocal, validateEquationStep } from './local-validator';
import type { FormulaRSettings } from '../settings';
import type { ClaudeClient } from './claude-client';

export class ValidationOrchestrator {
	constructor(
		private getSettings: () => FormulaRSettings,
		private getClaudeClient: () => ClaudeClient | null
	) {}

	async validateBlocks(blocks: AlignBlock[]): Promise<BlockValidationResult[]> {
		return Promise.all(blocks.map(block => this.validateBlock(block)));
	}

	private async validateBlock(block: AlignBlock): Promise<BlockValidationResult> {
		const settings = this.getSettings();
		const results: StepValidationResult[] = [];

		if (block.steps.length === 0) {
			return { blockFromPos: block.fromPos, results };
		}

		if (block.steps.length === 1) {
			// Single equation: validate if it holds as a mathematical identity
			const step = block.steps[0]!;
			let result = this.runLocalEquation(step, settings);
			result = await this.maybeEscalateSingle(result, block, settings);
			if (result.status !== 'valid') results.push(result);
		} else {
			// Multi-step derivation: validate each step transition
			for (let i = 0; i < block.steps.length - 1; i++) {
				const prev = block.steps[i];
				const curr = block.steps[i + 1];
				if (!prev || !curr) continue;

				let result = this.runLocalTransition(prev, curr, settings);
				result = await this.maybeEscalateTransition(result, block, i, settings);

				if (result.status !== 'valid') results.push(result);
			}
		}

		return { blockFromPos: block.fromPos, results };
	}

	private runLocalEquation(step: import('./types').AlignStep, settings: FormulaRSettings): StepValidationResult {
		if (!settings.enableLocalValidation) {
			return {
				stepIndex: step.index, status: 'uncertain',
				message: '本地验证已禁用', usedClaude: false,
				fromPos: step.fromPos, toPos: step.toPos,
			};
		}
		return validateEquationStep(step);
	}

	private runLocalTransition(
		prev: import('./types').AlignStep,
		curr: import('./types').AlignStep,
		settings: FormulaRSettings
	): StepValidationResult {
		if (!settings.enableLocalValidation) {
			return {
				stepIndex: curr.index, status: 'uncertain',
				message: '本地验证已禁用', usedClaude: false,
				fromPos: curr.fromPos, toPos: curr.toPos,
			};
		}
		return validateStepLocal(prev, curr);
	}

	private async maybeEscalateSingle(
		result: StepValidationResult,
		block: AlignBlock,
		settings: FormulaRSettings
	): Promise<StepValidationResult> {
		if (result.status !== 'uncertain') return result;
		if (!settings.enableClaudeValidation) return result;
		const client = this.getClaudeClient();
		if (!client) {
			return { ...result, message: '请在设置中填写 API 地址和 Key' };
		}
		const claudeResult = await client.validateStep(block.steps, -1).catch((e: unknown) => {
			return { status: 'error' as const, message: `AI 接口调用失败：${e instanceof Error ? e.message : String(e)}` };
		});
		if (!claudeResult) {
			return { ...result, message: 'AI 接口调用失败' };
		}
		return { ...result, ...claudeResult, usedClaude: true };
	}

	private async maybeEscalateTransition(
		result: StepValidationResult,
		block: AlignBlock,
		stepIdx: number,
		settings: FormulaRSettings
	): Promise<StepValidationResult> {
		if (result.status !== 'uncertain') return result;
		if (!settings.enableClaudeValidation) return result;
		const client = this.getClaudeClient();
		if (!client) {
			return { ...result, message: '请在设置中填写 API 地址和 Key' };
		}
		const claudeResult = await client.validateStep(block.steps, stepIdx).catch((e: unknown) => {
			return { status: 'error' as const, message: `AI 接口调用失败：${e instanceof Error ? e.message : String(e)}` };
		});
		if (!claudeResult) {
			return { ...result, message: 'AI 接口调用失败' };
		}
		return { ...result, ...claudeResult, usedClaude: true };
	}
}
