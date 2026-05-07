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
		containerEl.createEl('h2', { text: 'FormulaR 设置' });

		containerEl.createEl('h3', { text: 'AI 接口配置' });

		new Setting(containerEl)
			.setName('API 地址')
			.setDesc('支持 Claude（api.anthropic.com）或任意 OpenAI 兼容接口（如 Ollama、OpenAI、本地模型）')
			.addText(text => text
				.setPlaceholder('https://api.anthropic.com')
				.setValue(this.plugin.settings.apiBaseUrl)
				.onChange(async (value) => {
					this.plugin.settings.apiBaseUrl = value.trim().replace(/\/$/, '');
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('API Key')
			.setDesc('填写对应服务的 API Key；本地服务（如 Ollama）可留空')
			.addText(text => {
				text.setPlaceholder('sk-ant-... 或 sk-...')
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
				return text;
			});

		new Setting(containerEl)
			.setName('模型名称')
			.setDesc('填写模型 ID，如 claude-3-5-haiku-20241022、gpt-4o、llama3、qwen2.5 等')
			.addText(text => text
				.setPlaceholder('claude-3-5-haiku-20241022')
				.setValue(this.plugin.settings.model)
				.onChange(async (value) => {
					this.plugin.settings.model = value.trim();
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: '验证行为' });

		new Setting(containerEl)
			.setName('验证延迟（毫秒）')
			.setDesc('停止输入后多久触发验证')
			.addSlider(slider => slider
				.setLimits(500, 3000, 500)
				.setValue(this.plugin.settings.debounceMs)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.debounceMs = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('启用本地验证')
			.setDesc('使用 mathjs 进行代数等价性验证（离线可用）')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableLocalValidation)
				.onChange(async (value) => {
					this.plugin.settings.enableLocalValidation = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('启用 AI 验证')
			.setDesc('本地无法判断时调用 AI 接口（需要填写 API 地址和 Key）')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableClaudeValidation)
				.onChange(async (value) => {
					this.plugin.settings.enableClaudeValidation = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('启用自动补全')
			.setDesc('在推导块末尾输入 \\\\ 时提供下一步建议（需要 AI 接口）')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAutoComplete)
				.onChange(async (value) => {
					this.plugin.settings.enableAutoComplete = value;
					await this.plugin.saveSettings();
				}));
	}
}
