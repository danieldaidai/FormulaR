import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, FormulaRSettings, FormulaRSettingTab } from './settings';
import { validationField } from './editor/validation-state';
import { buildValidationViewPlugin } from './editor/validation-view';
import { formulaHoverTooltip } from './editor/hover-tooltip';
import { NextStepSuggest } from './suggest/next-step-suggest';
import { ClaudeClient } from './engine/claude-client';

export default class FormulaRPlugin extends Plugin {
	settings: FormulaRSettings = DEFAULT_SETTINGS;
	private claudeClient: ClaudeClient | null = null;

	async onload() {
		await this.loadSettings();
		this.initClaudeClient();

		this.registerEditorExtension([
			validationField,
			buildValidationViewPlugin(
				() => this.settings,
				() => this.claudeClient
			),
			formulaHoverTooltip,
		]);

		this.registerEditorSuggest(
			new NextStepSuggest(this.app, () => this.claudeClient)
		);

		this.addSettingTab(new FormulaRSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData() as Partial<FormulaRSettings>
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.initClaudeClient();
	}

	private initClaudeClient() {
		const { apiKey, model, apiBaseUrl } = this.settings;
		this.claudeClient = (apiKey || apiBaseUrl)
			? new ClaudeClient(apiKey, model, apiBaseUrl)
			: null;
	}
}
