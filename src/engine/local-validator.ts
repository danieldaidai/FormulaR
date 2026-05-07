import * as math from 'mathjs';
import { AlignStep, StepValidationResult } from './types';
import { latexToMathNode, collectFreeVars, evalLatexNumerically, collectFreeVarsFromLatex } from './latex-to-mathjs';

const SAMPLE_COUNT = 50;
const VALID_THRESHOLD = 0.96;
const INVALID_THRESHOLD = 0.04;
const MIN_VALID_SAMPLES = 20;

function randomInRange(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

type EvalResult = 'valid' | 'invalid' | 'uncertain';

function makeBase(step: AlignStep) {
	return { stepIndex: step.index, usedClaude: false, fromPos: step.fromPos, toPos: step.toPos };
}

/**
 * Check whether lhsLatex ≈ rhsLatex numerically across random variable samples.
 * Handles definite integrals via Simpson's rule.
 */
function checkExprEquality(lhsLatex: string, rhsLatex: string): EvalResult {
	const hasIntegral = lhsLatex.includes('\\int') || rhsLatex.includes('\\int');

	// Collect free variables (integration variables excluded from integrals)
	const lhsVars = collectFreeVarsFromLatex(lhsLatex);
	const rhsVars = collectFreeVarsFromLatex(rhsLatex);
	const allVars = [...new Set([...lhsVars, ...rhsVars])];

	// Use positive range for integrals to avoid lower-limit-equals-upper edge cases
	const sampleMin = hasIntegral ? 0.5 : -10;
	const sampleMax = hasIntegral ? 5.0 : 10;
	// Slightly looser tolerance for numerical integration
	const tolerance = hasIntegral ? 1e-5 : 1e-9;

	let nearEqual = 0, finite = 0;

	for (let i = 0; i < SAMPLE_COUNT; i++) {
		const scope: Record<string, number> = {};
		for (const v of allVars) scope[v] = randomInRange(sampleMin, sampleMax);

		const lhsVal = evalLatexNumerically(lhsLatex, scope);
		const rhsVal = evalLatexNumerically(rhsLatex, scope);

		if (lhsVal === null || rhsVal === null) continue;
		if (!isFinite(lhsVal) || !isFinite(rhsVal)) continue;
		finite++;
		if (Math.abs(lhsVal - rhsVal) < tolerance) nearEqual++;
	}

	if (finite < MIN_VALID_SAMPLES) return 'uncertain';
	const r = nearEqual / finite;
	if (r >= VALID_THRESHOLD) return 'valid';
	if (r <= INVALID_THRESHOLD) return 'invalid';
	return 'uncertain';
}

/**
 * Validate a single equation step as a mathematical identity (lhs = rhs should hold).
 * Used when the align block has only one step.
 */
export function validateEquationStep(step: AlignStep): StepValidationResult {
	const base = makeBase(step);
	if (!step.lhs || !step.rhs) {
		return { ...base, status: 'uncertain', message: '无法解析等式两边，建议配置 AI 验证' };
	}
	try {
		const result = checkExprEquality(step.lhs, step.rhs);
		switch (result) {
			case 'valid':
				return { ...base, status: 'valid', message: '等式成立（数值检验通过）' };
			case 'invalid':
				return { ...base, status: 'invalid', message: '等式不成立：左右两边数值不相等' };
			case 'uncertain':
				return { ...base, status: 'uncertain', message: '本地无法完全验证（如复杂积分、级数等），建议配置 AI' };
		}
	} catch {
		return { ...base, status: 'uncertain', message: '本地验证出错，建议配置 AI 验证' };
	}
}

/**
 * Validate a step-to-step transition: the residual (lhs - rhs) of adjacent steps should be equal.
 */
export function validateStepLocal(prevStep: AlignStep, currStep: AlignStep): StepValidationResult {
	const base = makeBase(currStep);

	try {
		// Build residual node for a step
		const buildResidualNode = (step: AlignStep, fallbackLhsNode: math.MathNode | null): math.MathNode | null => {
			const rhsNode = latexToMathNode(step.rhs);
			if (!rhsNode) return null;
			const lhsNode = step.lhs ? latexToMathNode(step.lhs) : fallbackLhsNode;
			if (!lhsNode) return null;
			return math.parse(`(${lhsNode.toString()}) - (${rhsNode.toString()})`);
		};

		// If either step has an integral, the residual approach doesn't work well;
		// fall back to uncertain so Claude can handle it.
		if (prevStep.lhs.includes('\\int') || prevStep.rhs.includes('\\int') ||
			currStep.lhs.includes('\\int') || currStep.rhs.includes('\\int')) {
			return { ...base, status: 'uncertain', message: '步骤含积分，本地无法验证推导合法性，建议配置 AI' };
		}

		const prevRhsNode = latexToMathNode(prevStep.rhs);
		const residualPrev = buildResidualNode(prevStep, null);
		const residualCurr = buildResidualNode(currStep, prevRhsNode);

		if (!residualPrev || !residualCurr) {
			return { ...base, status: 'uncertain', message: '包含本地无法解析的表达式，建议配置 AI 验证' };
		}

		const vars = [...new Set([...collectFreeVars(residualPrev), ...collectFreeVars(residualCurr)])];
		let matches = 0, finite = 0;

		for (let i = 0; i < SAMPLE_COUNT; i++) {
			const scope: Record<string, number> = {};
			for (const v of vars) scope[v] = randomInRange(-10, 10);
			try {
				const a = Number(residualPrev.evaluate(scope));
				const b = Number(residualCurr.evaluate(scope));
				if (!isFinite(a) || !isFinite(b) || isNaN(a) || isNaN(b)) continue;
				finite++;
				if (Math.abs(a - b) < 1e-9) matches++;
			} catch { /* skip */ }
		}

		if (finite < MIN_VALID_SAMPLES) {
			return { ...base, status: 'uncertain', message: '本地验证不确定（如开方、换元等），建议配置 AI' };
		}
		const r = matches / finite;
		if (r >= VALID_THRESHOLD) return { ...base, status: 'valid',     message: '代数变换正确' };
		if (r <= INVALID_THRESHOLD) return { ...base, status: 'invalid', message: '推导步骤有误（代数等价性检验失败）' };
		return { ...base, status: 'uncertain', message: '本地验证不确定（如开方、换元等），建议配置 AI' };

	} catch {
		return { ...base, status: 'uncertain', message: '本地验证出错，建议配置 AI 验证' };
	}
}
