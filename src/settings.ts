import { App, PluginSettingTab, Setting } from 'obsidian';
import type FormulaRPlugin from './main';

export interface FormulaRSettings {
	apiBaseUrl: string;
	apiKey: string;
	model: string;
	debounceMs: number;
	enableLocalValidation: boolean;
	enableClaudeValidation: boolean;
	enableAutoComplete: boolean;
	samplingCount: number;
	maxClaudeCallsPerBlock: number;
}

export const DEFAULT_SETTINGS: FormulaRSettings = {
	apiBaseUrl: 'https://api.anthropic.com',
	apiKey: '',
	model: 'claude-3-5-haiku-20241022',
	debounceMs: 1500,
	enableLocalValidation: true,
	enableClaudeValidation: true,
	enableAutoComplete: true,
	samplingCount: 50,
	maxClaudeCallsPerBlock: 3,
};

export class FormulaRSettingTab extends PluginSettingTab {
	plugin: FormulaRPlugin;

	constructor(app: App, plugin: FormulaRPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('API configuration').setHeading();

		new Setting(containerEl)
			.setName('API base URL')
			.setDesc('Base URL of the AI API to call; defaults to https://api.anthropic.com')
			.addText(text => text
				.setPlaceholder('https://api.anthropic.com')
				.setValue(this.plugin.settings.apiBaseUrl)
				.onChange(async (value) => {
					this.plugin.settings.apiBaseUrl = value.trim().replace(/\/$/, '');
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('API key')
			.setDesc('API key for the endpoint above; leave empty if no authentication is required')
			.addText(text => {
				text.setPlaceholder('Your API key')
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
				return text;
			});

		new Setting(containerEl)
			.setName('Model')
			.setDesc('Model name for the configured endpoint')
			.addText(text => text
				.setValue(this.plugin.settings.model)
				.onChange(async (value) => {
					this.plugin.settings.model = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl).setName('Validation').setHeading();

		new Setting(containerEl)
			.setName('Validation delay (ms)')
			.setDesc('How long to wait after you stop typing before triggering validation')
			.addSlider(slider => slider
				.setLimits(500, 3000, 500)
				.setValue(this.plugin.settings.debounceMs)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.debounceMs = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable local validation')
			.setDesc('Use mathjs for algebraic equivalence checking (works offline)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableLocalValidation)
				.onChange(async (value) => {
					this.plugin.settings.enableLocalValidation = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable AI validation')
			.setDesc('Call the AI when local validation is inconclusive (requires API base URL and key)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableClaudeValidation)
				.onChange(async (value) => {
					this.plugin.settings.enableClaudeValidation = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable autocomplete')
			.setDesc('Suggest next derivation steps when you type \\\\ at the end of an align block (requires AI)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAutoComplete)
				.onChange(async (value) => {
					this.plugin.settings.enableAutoComplete = value;
					await this.plugin.saveSettings();
				}));
	}
}
