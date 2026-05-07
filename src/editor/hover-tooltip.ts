import { hoverTooltip } from '@codemirror/view';
import { validationField } from './validation-state';

export const formulaHoverTooltip = hoverTooltip((view, pos) => {
	const store = view.state.field(validationField);

	let found = null;
	for (const result of store.resultsByPos.values()) {
		if (
			(result.status === 'invalid' || result.status === 'error' || result.status === 'uncertain') &&
			pos >= result.fromPos &&
			pos <= result.toPos
		) {
			found = result;
			break;
		}
	}

	if (!found) return null;

	const result = found;
	return {
		pos: result.fromPos,
		end: result.toPos,
		above: true,
		create() {
			const dom = document.createElement('div');
			dom.className = result.status === 'uncertain'
			? 'formular-uncertain-tooltip'
			: 'formular-error-tooltip';
			dom.textContent = result.message;
			return { dom };
		},
	};
}, { hoverTime: 400 });
