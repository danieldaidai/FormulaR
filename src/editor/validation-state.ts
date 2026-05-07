import { StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { StepValidationResult, ValidationEffectPayload } from '../engine/types';

export const setValidationResults = StateEffect.define<ValidationEffectPayload>();
export const clearValidationResults = StateEffect.define<{ blockFromPos: number }>();

interface ValidationStore {
	decorations: DecorationSet;
	resultsByPos: Map<number, StepValidationResult>;
}

const errorMark     = Decoration.mark({ class: 'formular-error-mark' });
const uncertainMark = Decoration.mark({ class: 'formular-uncertain-mark' });

export const validationField = StateField.define<ValidationStore>({
	create() {
		return { decorations: Decoration.none, resultsByPos: new Map() };
	},

	update(store, tr) {
		let newDecos = store.decorations.map(tr.changes);
		const newResults = new Map(store.resultsByPos);

		for (const effect of tr.effects) {
			if (effect.is(setValidationResults)) {
				const payload = effect.value;
				// Remove old results for this block
				for (const [pos, result] of newResults) {
					if (result.fromPos >= payload.blockFromPos) {
						newResults.delete(pos);
					}
				}
				// Add new results
				for (const result of payload.results) {
					newResults.set(result.fromPos, result);
				}
				// Rebuild DecorationSet from all current results
				newDecos = buildDecorations(newResults);
			}
			if (effect.is(clearValidationResults)) {
				for (const [pos, result] of newResults) {
					if (result.fromPos >= effect.value.blockFromPos) {
						newResults.delete(pos);
					}
				}
				newDecos = buildDecorations(newResults);
			}
		}

		return { decorations: newDecos, resultsByPos: newResults };
	},

	provide(field) {
		return EditorView.decorations.from(field, store => store.decorations);
	},
});

function buildDecorations(results: Map<number, StepValidationResult>): DecorationSet {
	const sorted = [...results.values()]
		.filter(r => r.status === 'invalid' || r.status === 'error' || r.status === 'uncertain')
		.sort((a, b) => a.fromPos - b.fromPos);

	if (sorted.length === 0) return Decoration.none;

	const builder = new RangeSetBuilder<Decoration>();
	for (const result of sorted) {
		if (result.fromPos < result.toPos) {
			const mark = (result.status === 'invalid' || result.status === 'error')
				? errorMark
				: uncertainMark;
			builder.add(result.fromPos, result.toPos, mark);
		}
	}
	return builder.finish();
}
