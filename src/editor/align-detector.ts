import { EditorState } from '@codemirror/state';
import { AlignBlock } from '../engine/types';
import { parseAlignBlock } from '../engine/align-parser';

const ALIGN_RE = /\\begin\{align\*?\}/;
// Lazy match: $$ ... $$ (handles multiline)
const MATH_BLOCK_RE = /\$\$([\s\S]*?)\$\$/g;

export function detectAlignBlocks(state: EditorState): AlignBlock[] {
	const blocks: AlignBlock[] = [];
	const text = state.doc.toString();

	let match: RegExpExecArray | null;
	MATH_BLOCK_RE.lastIndex = 0;
	while ((match = MATH_BLOCK_RE.exec(text)) !== null) {
		if (!ALIGN_RE.test(match[0])) continue;
		const steps = parseAlignBlock(match[0], match.index);
		if (steps.length > 0) {
			blocks.push({
				fromPos: match.index,
				toPos: match.index + match[0].length,
				steps,
			});
		}
	}

	return blocks;
}
