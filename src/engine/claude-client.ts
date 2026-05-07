import { AlignStep, NextStepSuggestion, StepValidationResult } from './types';

interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

// ---- Response shapes ----

interface ClaudeResponse {
	content: Array<{ type: string; text: string }>;
}

interface OpenAIResponse {
	choices: Array<{ message: { role: string; content: string } }>;
}

export class ClaudeClient {
	private baseUrl: string;
	private apiKey: string;
	private model: string;

	constructor(apiKey: string, model: string, baseUrl = 'https://api.anthropic.com') {
		this.apiKey = apiKey;
		this.model = model;
		// Normalise: strip trailing slash and /v1 suffix so we can consistently append /v1/...
		this.baseUrl = baseUrl.replace(/\/$/, '').replace(/\/v1$/, '');
	}

	/** true when the base URL points to the official Anthropic API. */
	private isAnthropicApi(): boolean {
		return this.baseUrl.includes('anthropic.com');
	}

	// ---- Low-level HTTP helpers ----

	private async callAnthropic(system: string, messages: ChatMessage[], maxTokens: number): Promise<string> {
		const res = await fetch(`${this.baseUrl}/v1/messages`, {
			method: 'POST',
			headers: {
				'x-api-key': this.apiKey,
				'anthropic-version': '2023-06-01',
				'content-type': 'application/json',
			},
			body: JSON.stringify({ model: this.model, max_tokens: maxTokens, system, messages }),
		});
		if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${res.statusText}`);
		const data = await res.json() as ClaudeResponse;
		const first = data.content[0];
		if (!first || first.type !== 'text') throw new Error('Unexpected Anthropic response format');
		return first.text;
	}

	private async callOpenAI(system: string, messages: ChatMessage[], maxTokens: number): Promise<string> {
		const allMessages = [
			{ role: 'system' as const, content: system },
			...messages,
		];
		const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
			method: 'POST',
			headers: {
				...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
				'content-type': 'application/json',
			},
			body: JSON.stringify({ model: this.model, max_tokens: maxTokens, messages: allMessages }),
		});
		if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
		const data = await res.json() as OpenAIResponse;
		const choice = data.choices[0];
		if (!choice) throw new Error('Empty response from API');
		return choice.message.content;
	}

	private callApi(system: string, messages: ChatMessage[], maxTokens: number): Promise<string> {
		return this.isAnthropicApi()
			? this.callAnthropic(system, messages, maxTokens)
			: this.callOpenAI(system, messages, maxTokens);
	}

	// ---- Public methods ----

	async validateStep(
		steps: AlignStep[],
		prevIndex: number
	): Promise<Pick<StepValidationResult, 'status' | 'message'>> {
		const isSingle = prevIndex === -1;
		const prev = isSingle ? steps[0] : steps[prevIndex];
		const curr = isSingle ? steps[0] : steps[prevIndex + 1];
		if (!prev || !curr) return { status: 'error', message: '步骤索引越界' };

		const context = steps.map((s, i) =>
			`第${i + 1}步：${s.lhs ? s.lhs + ' = ' : ''}${s.rhs}`
		).join('\n');

		const system = `你是一个严格的数学推导验证器。
${isSingle
	? '判断给定等式是否作为数学恒等式成立（对所有合法变量值）。'
	: '判断两个相邻推导步骤之间的变换是否代数合法。只考虑代数等价性，不考虑语义或物理意义。'
}
输出严格 JSON（不含任何其他文本）：{"valid": true/false, "reason": "中文简短解释（30字以内）"}`;

		const userContent = isSingle
			? `请判断以下等式是否成立：\n${prev.lhs} = ${prev.rhs}\n\n输出 JSON：`
			: `验证第${prevIndex + 1}步→第${prevIndex + 2}步是否合法：

第${prevIndex + 1}步：${prev.lhs ? prev.lhs + ' = ' : ''}${prev.rhs}
第${prevIndex + 2}步：${curr.lhs ? curr.lhs + ' = ' : ''}${curr.rhs}

完整推导：\n${context}\n\n输出 JSON：`;

		const text = await this.callApi(system, [{ role: 'user', content: userContent }], 200);
		const json = JSON.parse(extractJson(text)) as { valid: boolean; reason: string };
		return { status: json.valid ? 'valid' : 'invalid', message: json.reason };
	}

	async suggestNextStep(steps: AlignStep[]): Promise<NextStepSuggestion[]> {
		if (steps.length === 0) return [];

		const context = steps.map((s, i) =>
			`第${i + 1}步：${s.lhs ? s.lhs + ' = ' : ''}${s.rhs}`
		).join('\n');

		const system = `你是数学推导助手。根据已有推导步骤，预测最合理的下一步（1-3个选项）。
输出严格 JSON 数组（不含任何其他文本）：
[{"latex": "下一步 LaTeX（仅右侧表达式）", "explanation": "中文说明（20字以内）", "confidence": "high/medium"}]`;

		try {
			const text = await this.callApi(
				system,
				[{ role: 'user', content: `当前推导：\n${context}\n\n请给出下一步建议：` }],
				500
			);
			const json = JSON.parse(extractJson(text)) as NextStepSuggestion[];
			return Array.isArray(json) ? json : [];
		} catch {
			return [];
		}
	}
}

function extractJson(text: string): string {
	const match = /(\{[\s\S]*\}|\[[\s\S]*\])/.exec(text);
	return match ? match[0] : text;
}
