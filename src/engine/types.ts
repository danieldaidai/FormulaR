export interface AlignStep {
	index: number;
	rawLatex: string;
	lhs: string;
	rhs: string;
	fromPos: number;
	toPos: number;
}

export interface AlignBlock {
	fromPos: number;
	toPos: number;
	steps: AlignStep[];
}

export type StepValidationStatus = 'valid' | 'invalid' | 'uncertain' | 'pending' | 'error';

export interface StepValidationResult {
	stepIndex: number;
	status: StepValidationStatus;
	message: string;
	usedClaude: boolean;
	fromPos: number;
	toPos: number;
}

export interface BlockValidationResult {
	blockFromPos: number;
	results: StepValidationResult[];
}

export interface ValidationEffectPayload {
	blockFromPos: number;
	results: StepValidationResult[];
}

export interface NextStepSuggestion {
	latex: string;
	explanation: string;
	confidence: 'high' | 'medium';
}
