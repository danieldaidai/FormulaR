import { ViewPlugin, ViewUpdate, EditorView } from '@codemirror/view';
import { setValidationResults, clearValidationResults } from './validation-state';
import { detectAlignBlocks } from './align-detector';
import { ValidationOrchestrator } from '../engine/validation-orchestrator';
import type { FormulaRSettings } from '../settings';
import type { ClaudeClient } from '../engine/claude-client';

export function buildValidationViewPlugin(
	getSettings: () => FormulaRSettings,
	getClaudeClient: () => ClaudeClient | null
) {
	class ValidationViewPlugin {
		private debounceTimer: ReturnType<typeof setTimeout> | null = null;
		private currentVersion = 0;
		private orchestrator: ValidationOrchestrator;

		constructor(private view: EditorView) {
			this.orchestrator = new ValidationOrchestrator(getSettings, getClaudeClient);
		}

		update(update: ViewUpdate) {
			if (!update.docChanged) return;

			if (this.debounceTimer) clearTimeout(this.debounceTimer);

			const settings = getSettings();
			this.debounceTimer = setTimeout(async () => {
				const version = ++this.currentVersion;
				try {
					const blocks = detectAlignBlocks(update.state);
					if (blocks.length === 0) return;

					// Clear stale results immediately
					this.view.dispatch({
						effects: blocks.map(b =>
							clearValidationResults.of({ blockFromPos: b.fromPos })
						),
					});

					const results = await this.orchestrator.validateBlocks(blocks);
					if (version !== this.currentVersion) return;

					this.view.dispatch({
						effects: results.map(r => setValidationResults.of(r)),
					});
				} catch (e) {
					console.error('[FormulaR] Validation error:', e);
				}
			}, settings.debounceMs);
		}

		destroy() {
			if (this.debounceTimer) clearTimeout(this.debounceTimer);
		}
	}

	return ViewPlugin.fromClass(ValidationViewPlugin);
}
