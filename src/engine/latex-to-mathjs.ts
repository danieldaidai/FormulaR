import * as math from 'mathjs';

const MATHJS_BUILTINS = new Set([
	'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
	'sinh', 'cosh', 'tanh',
	'sqrt', 'cbrt', 'nthRoot', 'abs', 'exp', 'log', 'log2', 'log10',
	'floor', 'ceil', 'round', 'sign', 'factorial',
	'pi', 'e', 'Infinity', 'i',
	'true', 'false', 'null', 'undefined',
]);

const PATCHES: Array<[RegExp, string]> = [
	[/&=/g, '='],
	[/&/g, ''],
	[/\\[,;!]|\\quad|\\qquad/g, ''],
	[/\\text\{[^}]*\}/g, ''],
	[/\\mathrm\{([^}]*)\}/g, '$1'],
	[/\\mathbf\{([^}]*)\}/g, '$1'],
	[/\\mathit\{([^}]*)\}/g, '$1'],
	[/\\left\s*\(/g, '('],
	[/\\right\s*\)/g, ')'],
	[/\\left\s*\[/g, '['],
	[/\\right\s*\]/g, ']'],
	[/\\left\s*\|/g, 'abs('],
	[/\\right\s*\|/g, ')'],
	[/\\left\s*\./g, ''],
	[/\\right\s*\./g, ''],
	[/\\times/g, '*'],
	[/\\cdot/g, '*'],
	[/\\div/g, '/'],
	[/\\pm/g, '+'],
	[/\\mp/g, '-'],
	[/\\infty/g, 'Infinity'],
	[/\\(sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh)\b/g, '$1'],
	[/\\ln\b/g, 'log'],
	[/\\log\b/g, 'log'],
	[/\\exp\b/g, 'exp'],
	[/\\alpha/g, 'alpha'], [/\\beta/g, 'beta'], [/\\gamma/g, 'gamma'],
	[/\\delta/g, 'delta'], [/\\epsilon/g, 'epsilon'], [/\\zeta/g, 'zeta'],
	[/\\eta/g, 'eta'], [/\\theta/g, 'theta'], [/\\iota/g, 'iota'],
	[/\\kappa/g, 'kappa'], [/\\lambda/g, 'lambda'], [/\\mu/g, 'mu'],
	[/\\nu/g, 'nu'], [/\\xi/g, 'xi'], [/\\pi/g, 'pi'],
	[/\\rho/g, 'rho'], [/\\sigma/g, 'sigma'], [/\\tau/g, 'tau'],
	[/\\upsilon/g, 'upsilon'], [/\\phi/g, 'phi'], [/\\chi/g, 'chi'],
	[/\\psi/g, 'psi'], [/\\omega/g, 'omega'],
	[/\\Gamma/g, 'Gamma'], [/\\Delta/g, 'Delta'], [/\\Theta/g, 'Theta'],
	[/\\Lambda/g, 'Lambda'], [/\\Pi/g, 'Pi'], [/\\Sigma/g, 'Sigma'],
	[/\\Phi/g, 'Phi'], [/\\Psi/g, 'Psi'], [/\\Omega/g, 'Omega'],
];

// ── Integral support ────────────────────────────────────────────────────────

export interface IntegralParts {
	lowerLatex: string;
	upperLatex: string;
	integrandLatex: string;
	variable: string;
}

/**
 * Parse a LaTeX definite integral: \int_a^b f(t) dt
 * Returns null for indefinite integrals or unrecognised patterns.
 */
export function extractIntegral(latex: string): IntegralParts | null {
	const s = latex.replace(/\\[,;!]|\\quad|\\qquad/g, ' ').trim();
	if (!s.startsWith('\\int')) return null;

	// Strip the differential at the end: d{var}
	const dMatch = /\s+d([a-zA-Z])\s*$/.exec(s);
	if (!dMatch) return null;

	const variable = dMatch[1]!;
	const beforeD = s.slice(0, dMatch.index).trim();

	// Parse \int then scripts
	let rest = beforeD.slice(4).trim(); // skip \int
	let lower = '';
	let upper = '';

	for (let i = 0; i < 2; i++) {
		if (rest.startsWith('_')) {
			const [content, len] = parseScript(rest.slice(1));
			lower = content;
			rest = rest.slice(1 + len).trim();
		} else if (rest.startsWith('^')) {
			const [content, len] = parseScript(rest.slice(1));
			upper = content;
			rest = rest.slice(1 + len).trim();
		} else {
			break;
		}
	}

	if (!lower || !upper) return null; // definite integral needs both limits
	return { lowerLatex: lower, upperLatex: upper, integrandLatex: rest.trim(), variable };
}

/** Parse a script value: {content} or bare token. Returns [content, charsConsumed]. */
function parseScript(s: string): [string, number] {
	if (s.startsWith('{')) {
		let depth = 0;
		for (let i = 0; i < s.length; i++) {
			if (s[i] === '{') depth++;
			else if (s[i] === '}') { depth--; if (depth === 0) return [s.slice(1, i), i + 1]; }
		}
		return [s.slice(1), s.length];
	}
	const m = /^([^\s^_\\{]+)/.exec(s);
	const tok = m ? m[0] : '';
	return [tok, tok.length];
}

/** Adaptive Simpson's rule numerical integration. */
function simpsonIntegral(f: (t: number) => number, a: number, b: number, n = 400): number {
	if (a === b) return 0;
	const h = (b - a) / n;
	let sum = f(a) + f(b);
	for (let i = 1; i < n; i++) {
		sum += (i % 2 === 0 ? 2 : 4) * f(a + i * h);
	}
	return (h / 3) * sum;
}

function evaluateDefiniteIntegral(parts: IntegralParts, scope: Record<string, number>): number | null {
	const lowerNode = latexToMathNode(parts.lowerLatex);
	const upperNode = latexToMathNode(parts.upperLatex);
	if (!lowerNode || !upperNode) return null;

	let lower: number, upper: number;
	try {
		lower = Number(lowerNode.evaluate(scope));
		upper = Number(upperNode.evaluate(scope));
	} catch { return null; }
	if (!isFinite(lower) || !isFinite(upper)) return null;

	const integrandNode = latexToMathNode(parts.integrandLatex);
	if (!integrandNode) return null;

	const { variable } = parts;
	const f = (t: number): number => {
		try { return Number(integrandNode.evaluate({ ...scope, [variable]: t })); }
		catch { return NaN; }
	};

	const result = simpsonIntegral(f, lower, upper);
	return isFinite(result) ? result : null;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Convert a LaTeX expression string to a mathjs-parseable string. */
export function latexToExpr(latex: string): string {
	let expr = latex;
	for (const [re, replacement] of PATCHES) expr = expr.replace(re, replacement);
	expr = replaceFrac(expr);
	expr = replaceSqrt(expr);
	expr = replacePower(expr);
	expr = expr.replace(/_\{([^}]*)\}/g, '_$1');
	expr = expr.replace(/\{/g, '(').replace(/\}/g, ')');
	return expr.trim();
}

/** Parse a LaTeX expression to a mathjs MathNode. Returns null on failure. */
export function latexToMathNode(latex: string): math.MathNode | null {
	try {
		const expr = latexToExpr(latex);
		if (!expr || expr === '=') return null;
		return math.parse(expr);
	} catch { return null; }
}

/**
 * Numerically evaluate a LaTeX expression given a variable scope.
 * Handles definite integrals via Simpson's rule.
 * Returns null if the expression cannot be evaluated.
 */
export function evalLatexNumerically(latex: string, scope: Record<string, number>): number | null {
	const trimmed = latex.trim();

	// Check if the whole expression is a definite integral
	const parts = extractIntegral(trimmed);
	if (parts) return evaluateDefiniteIntegral(parts, scope);

	// Standard mathjs path
	const node = latexToMathNode(trimmed);
	if (!node) return null;
	try {
		const val = Number(node.evaluate(scope));
		return isFinite(val) && !isNaN(val) ? val : null;
	} catch { return null; }
}

/**
 * Collect free variable names from a LaTeX expression.
 * For integrals, excludes the integration variable and only considers limit variables.
 */
export function collectFreeVarsFromLatex(latex: string): string[] {
	const parts = extractIntegral(latex.trim());
	if (parts) {
		const vars = new Set<string>();
		const lowerNode = latexToMathNode(parts.lowerLatex);
		const upperNode = latexToMathNode(parts.upperLatex);
		if (lowerNode) for (const v of collectFreeVars(lowerNode)) vars.add(v);
		if (upperNode) for (const v of collectFreeVars(upperNode)) vars.add(v);
		vars.delete(parts.variable);
		return [...vars];
	}
	const node = latexToMathNode(latex);
	return node ? collectFreeVars(node) : [];
}

/** Collect free variable names from a parsed mathjs MathNode. */
export function collectFreeVars(node: math.MathNode): string[] {
	const vars = new Set<string>();
	node.traverse((n: math.MathNode) => {
		if (n.type === 'SymbolNode') {
			const name = (n as math.SymbolNode).name;
			if (!MATHJS_BUILTINS.has(name)) vars.add(name);
		}
	});
	return [...vars];
}

// ── Private helpers ──────────────────────────────────────────────────────────

function replaceFrac(s: string): string {
	let result = s;
	let idx = result.indexOf('\\frac{');
	while (idx !== -1) {
		const afterFrac = idx + 6;
		const [num, endNum] = extractBraceContent(result, afterFrac - 1);
		const afterNum = endNum + 1;
		if (afterNum >= result.length || result[afterNum] !== '{') break;
		const [den, endDen] = extractBraceContent(result, afterNum);
		const replacement = `((${replaceFrac(num)})/(${replaceFrac(den)}))`;
		result = result.slice(0, idx) + replacement + result.slice(endDen + 1);
		idx = result.indexOf('\\frac{', idx + replacement.length);
	}
	return result;
}

function replaceSqrt(s: string): string {
	let result = s;
	let idx = result.indexOf('\\sqrt{');
	while (idx !== -1) {
		const afterSqrt = idx + 6;
		const [inner, endInner] = extractBraceContent(result, afterSqrt - 1);
		const replacement = `sqrt(${replaceSqrt(inner)})`;
		result = result.slice(0, idx) + replacement + result.slice(endInner + 1);
		idx = result.indexOf('\\sqrt{', idx + replacement.length);
	}
	return result;
}

function replacePower(s: string): string {
	let result = s;
	let idx = result.indexOf('^{');
	while (idx !== -1) {
		const [inner, endInner] = extractBraceContent(result, idx + 1);
		const replacement = `^(${replacePower(inner)})`;
		result = result.slice(0, idx) + replacement + result.slice(endInner + 1);
		idx = result.indexOf('^{', idx + replacement.length);
	}
	return result;
}

function extractBraceContent(s: string, openIdx: number): [string, number] {
	let depth = 0;
	for (let i = openIdx; i < s.length; i++) {
		if (s[i] === '{') depth++;
		else if (s[i] === '}') { depth--; if (depth === 0) return [s.slice(openIdx + 1, i), i]; }
	}
	return [s.slice(openIdx + 1), s.length - 1];
}
