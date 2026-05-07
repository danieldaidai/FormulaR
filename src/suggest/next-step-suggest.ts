import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from 'obsidian';
import { NextStepSuggestion, AlignStep } from '../engine/types';
import type { ClaudeClient } from '../engine/claude-client';

// Sentinel used when no API is configured
const NO_API_SENTINEL: NextStepSuggestion = {
	latex: '',
	explanation: '请先在设置中填写 API 地址和 Key',
	confidence: 'medium',
};

export class NextStepSuggest extends EditorSuggest<NextStepSuggestion> {
	constructor(app: App, private getClaudeClient: () => ClaudeClient | null) {
		super(app);
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile | null
	): EditorSuggestTriggerInfo | null {
		const currentLine = editor.getLine(cursor.line);
		const prevLine = cursor.line > 0 ? editor.getLine(cursor.line - 1) : '';

		let contentUpToLine: number;

		if (currentLine.trimEnd().endsWith('\\\\')) {
			// Cursor is on the line that ends with \\  (user just typed it)
			contentUpToLine = cursor.line;
		} else if (currentLine.trim() === '' && prevLine.trimEnd().endsWith('\\\\')) {
			// Cursor is on the blank line after pressing Enter following \\
			contentUpToLine = cursor.line - 1;
		} else {
			return null;
		}

		if (!this.isInsideAlignBlock(editor, cursor)) return null;

		return {
			start: { line: cursor.line, ch: 0 },
			end: cursor,
			query: this.extractAlignContent(editor, contentUpToLine),
		};
	}

	async getSuggestions(context: EditorSuggestContext): Promise<NextStepSuggestion[]> {
		const client = this.getClaudeClient();
		if (!client) return [NO_API_SENTINEL];

		const steps = this.parseStepsFromQuery(context.query);
		if (steps.length === 0) return [];

		try {
			const suggestions = await client.suggestNextStep(steps);
			return suggestions.length > 0 ? suggestions : [];
		} catch {
			return [];
		}
	}

	renderSuggestion(item: NextStepSuggestion, el: HTMLElement): void {
		const wrapper = el.createDiv({ cls: 'formular-suggest-item' });
		if (item.latex) {
			wrapper.createSpan({ cls: 'formular-suggest-latex', text: item.latex });
			wrapper.createSpan({ cls: 'formular-suggest-hint', text: ` — ${item.explanation}` });
		} else {
			// No-API sentinel: show only the explanation
			wrapper.createSpan({ cls: 'formular-suggest-hint formular-suggest-no-api', text: item.explanation });
		}
	}

	selectSuggestion(item: NextStepSuggestion, _evt: MouseEvent | KeyboardEvent): void {
		if (!this.context || !item.latex) return;
		const editor = this.context.editor;
		const cursor = editor.getCursor();
		// Insert next step on a new line with alignment
		editor.replaceRange(`\n\t&= ${item.latex} \\\\`, cursor);
		// Move cursor to after the inserted content
		editor.setCursor({ line: cursor.line + 1, ch: `\t&= ${item.latex} \\\\`.length });
	}

	private isInsideAlignBlock(editor: Editor, cursor: EditorPosition): boolean {
		let hasBegin = false;
		let hasEnd = false;
		const total = editor.lineCount();
		for (let i = cursor.line; i >= Math.max(0, cursor.line - 100); i--) {
			const l = editor.getLine(i);
			if (l.includes('\\begin{align')) { hasBegin = true; break; }
			if (l.includes('\\end{align')) return false;
		}
		if (!hasBegin) return false;
		for (let i = cursor.line; i < Math.min(total, cursor.line + 100); i++) {
			if (editor.getLine(i).includes('\\end{align')) { hasEnd = true; break; }
		}
		return hasEnd;
	}

	/**
	 * Scan backward from upToLine (inclusive) until \begin{align} or $$ is found,
	 * collecting the align step lines in order.
	 */
	private extractAlignContent(editor: Editor, upToLine: number): string {
		const lines: string[] = [];
		for (let i = upToLine; i >= Math.max(0, upToLine - 100); i--) {
			const l = editor.getLine(i);
			if (l.includes('\\begin{align') || l.trim() === '$$') break;
			lines.unshift(l);  // prepend to maintain top-down order
		}
		return lines
			.filter(l => l.trim() && !l.includes('\\end'))
			.join('\n');
	}

	private parseStepsFromQuery(query: string): AlignStep[] {
		const lines = query
			.split('\n')
			.filter(l => l.trim() && !l.includes('\\begin') && !l.includes('\\end'));

		return lines.map((line, i) => {
			const trimmed = line.trim().replace(/\\\\$/, '').trim();
			const ampIdx = trimmed.indexOf('&');
			let lhs = '', rhs = trimmed;
			if (ampIdx !== -1) {
				lhs = trimmed.slice(0, ampIdx).trim();
				let afterAmp = trimmed.slice(ampIdx + 1).trim();
				if (afterAmp.startsWith('=')) afterAmp = afterAmp.slice(1).trim();
				rhs = afterAmp;
			} else {
				const eqIdx = trimmed.indexOf('=');
				if (eqIdx !== -1) {
					lhs = trimmed.slice(0, eqIdx).trim();
					rhs = trimmed.slice(eqIdx + 1).trim();
				}
			}
			return { index: i, rawLatex: trimmed, lhs, rhs, fromPos: 0, toPos: 0 };
		});
	}
}
