import { AlignStep } from './types';

// Matches \begin{align} or \begin{align*}
const BEGIN_RE = /\\begin\{align\*?\}/;
const END_RE = /\\end\{align\*?\}/;

export function parseAlignBlock(rawText: string, blockStart: number): AlignStep[] {
	const beginMatch = BEGIN_RE.exec(rawText);
	const endMatch = END_RE.exec(rawText);
	if (!beginMatch || !endMatch) return [];

	const innerStart = beginMatch.index + beginMatch[0].length;
	const innerEnd = endMatch.index;
	const inner = rawText.slice(innerStart, innerEnd);

	// Split on \\ (line separator in align)
	const rawLines = inner.split('\\\\');
	const steps: AlignStep[] = [];

	let searchOffset = innerStart;

	for (let i = 0; i < rawLines.length; i++) {
		const rawLine = rawLines[i];
		if (rawLine === undefined) continue;
		const trimmed = rawLine.trim();
		if (!trimmed) {
			searchOffset += rawLine.length + 2; // +2 for \\
			continue;
		}

		// Find this line's position within rawText
		const lineRelStart = rawText.indexOf(trimmed, searchOffset);
		const lineRelEnd = lineRelStart + trimmed.length;
		searchOffset = lineRelEnd;

		const fromPos = blockStart + lineRelStart;
		const toPos = blockStart + lineRelEnd;

		// Split on first & to get lhs and rhs
		const ampIdx = trimmed.indexOf('&');
		let lhs: string;
		let rhs: string;

		if (ampIdx === -1) {
			// No & — try to split on first = to extract lhs and rhs
			const eqIdx = trimmed.indexOf('=');
			if (eqIdx !== -1) {
				lhs = trimmed.slice(0, eqIdx).trim();
				rhs = trimmed.slice(eqIdx + 1).trim();
			} else {
				lhs = '';
				rhs = trimmed;
			}
		} else {
			lhs = trimmed.slice(0, ampIdx).trim();
			// Remove the = after & if present
			let afterAmp = trimmed.slice(ampIdx + 1).trim();
			if (afterAmp.startsWith('=')) afterAmp = afterAmp.slice(1).trim();
			rhs = afterAmp;
		}

		steps.push({ index: i, rawLatex: trimmed, lhs, rhs, fromPos, toPos });
	}

	return steps;
}
