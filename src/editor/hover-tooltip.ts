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

	return {
		pos: found.fromPos,
		end: found.toPos,
		above: true,
		create() {
			const dom = document.createElement('div');
			dom.className = found!.status === 'uncertain'
			? 'formular-uncertain-tooltip'
			: 'formular-error-tooltip';
			dom.textContent = found!.message;
			return { dom };
		},
	};
}, { hoverTime: 400 });
