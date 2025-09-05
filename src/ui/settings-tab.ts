import { App, PluginSettingTab, Setting, Notice, TFile } from 'obsidian';

import { DiscordRPCSettings } from '../types/settings';

export interface SettingsTabCallbacks {
	onToggleConnection: () => Promise<void>;
	onSettingsChange: (settings: DiscordRPCSettings) => Promise<void>;
	isConnected: () => boolean;
	isEnabled: () => boolean;
}

export class DiscordRPCSettingTab extends PluginSettingTab {
	private settings: DiscordRPCSettings;
	private callbacks: SettingsTabCallbacks;

	constructor(app: App, plugin: any, settings: DiscordRPCSettings, callbacks: SettingsTabCallbacks) {
		super(app, plugin);
		this.settings = settings;
		this.callbacks = callbacks;
	}

	updateSettings(settings: DiscordRPCSettings) {
		this.settings = settings;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Discord Rich Presence Settings' });

		this.renderConnectionSection();
		this.renderDisplayOptions();
		this.renderPrivacySettings();
		this.renderCustomTemplates();
		this.renderCustomButton();
		this.renderHelpSection();
	}

	private renderConnectionSection() {
		const { containerEl } = this;

		const statusDiv = containerEl.createDiv('discord-rpc-status-container');
		
		const statusText = statusDiv.createEl('div');
		const isConnected = this.callbacks.isConnected();
		
		statusText.createEl('strong', { text: 'Status: ' });
		statusText.createEl('span', {
			cls: isConnected ? 'discord-rpc-status-connected' : 'discord-rpc-status-disconnected',
			text: isConnected ? '✓ Connected to Discord' : '✗ Not connected to Discord'
		});

		new Setting(containerEl)
			.setName('Discord Rich Presence')
			.setDesc('Enable or disable Discord Rich Presence')
			.addButton(button => {
				button
					.setButtonText(this.callbacks.isEnabled() ? 'Disconnect' : 'Connect')
					.setCta()
					.onClick(async () => {
						await this.callbacks.onToggleConnection();
						this.displayWithScrollPreservation();
					});
			});
	}

	private renderDisplayOptions() {
		const { containerEl } = this;

		containerEl.createEl('h3', { text: 'Display Options' });

		new Setting(containerEl)
			.setName('Show file name')
			.setDesc('Display the name of the currently open file')
			.addToggle(toggle => toggle
				.setValue(this.settings.showFileName)
				.onChange(async (value) => {
					this.settings.showFileName = value;
					await this.callbacks.onSettingsChange(this.settings);
				}));

		new Setting(containerEl)
			.setName('Show vault name')
			.setDesc('Display the name of the current vault')
			.addToggle(toggle => toggle
				.setValue(this.settings.showVaultName)
				.onChange(async (value) => {
					this.settings.showVaultName = value;
					await this.callbacks.onSettingsChange(this.settings);
				}));

		new Setting(containerEl)
			.setName('Time tracking mode')
			.setDesc('Choose between showing time for current file or entire session')
			.addDropdown(dropdown => dropdown
				.addOption('file', 'Current file time')
				.addOption('session', 'Session time')
				.setValue(this.settings.timeMode)
				.onChange(async (value: 'file' | 'session') => {
					this.settings.timeMode = value;
					await this.callbacks.onSettingsChange(this.settings);
				}));
	}

	private renderPrivacySettings() {
		const { containerEl } = this;

		containerEl.createEl('h3', { text: 'Privacy Settings' });

		new Setting(containerEl)
			.setName('Hide vault name')
			.setDesc('Hide the actual vault name and show generic text instead')
			.addToggle(toggle => toggle
				.setValue(this.settings.hideVaultName)
				.onChange(async (value) => {
					this.settings.hideVaultName = value;
					await this.callbacks.onSettingsChange(this.settings);
				}));

		new Setting(containerEl)
			.setName('Hide note name')
			.setDesc('Hide specific note names and show generic "a document" instead')
			.addToggle(toggle => toggle
				.setValue(this.settings.hideNoteName)
				.onChange(async (value) => {
					this.settings.hideNoteName = value;
					await this.callbacks.onSettingsChange(this.settings);
				}));

		new Setting(containerEl)
			.setName('Hide specific files/folders')
			.setDesc('Hide notes that match exact paths or entire folders')
			.addToggle(toggle => toggle
				.setValue(this.settings.hideSpecificPaths)
				.onChange(async (value) => {
					this.settings.hideSpecificPaths = value;
					await this.callbacks.onSettingsChange(this.settings);
					this.displayWithScrollPreservation();
				}));

		if (this.settings.hideSpecificPaths) {
			this.renderHiddenPaths();
		}
	}

	private renderHiddenPaths() {
		const { containerEl } = this;

		this.settings.hiddenPaths.forEach((path, index) => {
			new Setting(containerEl)
				.setName(`Hidden path ${index + 1}`)
				.setDesc('Exact file path or folder path to hide')
				.addText(text => {
					text.setPlaceholder('e.g., Private/, Personal/Diary.md, MyNotes.md')
						.setValue(path)
						.onChange(async (value) => {
							this.settings.hiddenPaths[index] = value.trim();
							await this.callbacks.onSettingsChange(this.settings);
						});
					
					this.setupPathSuggestions(text.inputEl);
				})
				.addButton(button => {
					button.setButtonText('Remove')
						.onClick(async () => {
							this.settings.hiddenPaths.splice(index, 1);
							await this.callbacks.onSettingsChange(this.settings);
							this.displayWithScrollPreservation();
						});
				});
		});

		new Setting(containerEl)
			.setName('Add hidden path')
			.setDesc('Add a new file, folder, or pattern to hide')
			.addButton(button => {
				button.setButtonText('Add path')
					.setCta()
					.onClick(async () => {
						this.settings.hiddenPaths.push('');
						await this.callbacks.onSettingsChange(this.settings);
						this.displayWithScrollPreservation();
					});
			});

		const helpDiv = containerEl.createDiv('discord-rpc-help-text');
		helpDiv.createEl('strong', { text: 'Pattern Examples:' });
		helpDiv.createEl('br');
		helpDiv.appendText('• ');
		helpDiv.createEl('code', { text: 'Private/' });
		helpDiv.appendText(' - Hide all files in Private folder');
		helpDiv.createEl('br');
		helpDiv.appendText('• ');
		helpDiv.createEl('code', { text: 'Personal/Diary.md' });
		helpDiv.appendText(' - Hide specific file in folder');
		helpDiv.createEl('br');
		helpDiv.appendText('• ');
		helpDiv.createEl('code', { text: 'MyDiary.md' });
		helpDiv.appendText(' - Hide specific file in root');
		helpDiv.createEl('br');
		helpDiv.appendText('• ');
		helpDiv.createEl('code', { text: 'Work/' });
		helpDiv.appendText(' - Hide all files in Work folder');
		helpDiv.createEl('br');
		helpDiv.createEl('em', { text: 'Tip: Start typing to see file/folder suggestions' });
	}

	private renderCustomTemplates() {
		const { containerEl } = this;

		containerEl.createEl('h3', { text: 'Custom Text Templates' });

		new Setting(containerEl)
			.setName('Use custom templates')
			.setDesc('Create fully customizable presence text with placeholders')
			.addToggle(toggle => toggle
				.setValue(this.settings.useCustomTemplate)
				.onChange(async (value) => {
					this.settings.useCustomTemplate = value;
					await this.callbacks.onSettingsChange(this.settings);
					this.displayWithScrollPreservation();
				}));

		if (this.settings.useCustomTemplate) {
			this.renderTemplateFields();
		}
	}

	private renderTemplateFields() {
		const { containerEl } = this;

		new Setting(containerEl)
			.setName('Activity text template')
			.setDesc('Template for the top line of Discord presence')
			.addTextArea(text => {
				text.setPlaceholder('Example: %activity_type% %active_note_name% in %folder_name%/')
					.setValue(this.settings.customDetailsTemplate)
					.onChange(async (value) => {
						this.settings.customDetailsTemplate = value;
						await this.callbacks.onSettingsChange(this.settings);
					});
				text.inputEl.rows = 2;
				text.inputEl.classList.add('discord-rpc-template-textarea');
			});

		new Setting(containerEl)
			.setName('Location text template')
			.setDesc('Template for the bottom line of Discord presence')
			.addTextArea(text => {
				text.setPlaceholder('Example: %vault_name% workspace')
					.setValue(this.settings.customStateTemplate)
					.onChange(async (value) => {
						this.settings.customStateTemplate = value;
						await this.callbacks.onSettingsChange(this.settings);
					});
				text.inputEl.rows = 2;
				text.inputEl.classList.add('discord-rpc-template-textarea');
			});

		const placeholderDiv = containerEl.createDiv('discord-rpc-placeholder-help');
		placeholderDiv.createEl('strong', { text: 'Available Placeholders:' });
		placeholderDiv.createEl('br');
		
		const placeholders = [
			{ code: '%activity_type%', desc: '"Reading" or "Editing" based on current mode' },
			{ code: '%active_note_name%', desc: 'Current note name' },
			{ code: '%active_note_path%', desc: 'Full path to current note' },
			{ code: '%vault_name%', desc: 'Vault name' },
			{ code: '%folder_name%', desc: 'Current note\'s folder' },
			{ code: '%file_extension%', desc: 'File extension (md, txt, etc.)' },
			{ code: '%workspace_name%', desc: 'Same as vault name' }
		];
		
		placeholders.forEach(placeholder => {
			placeholderDiv.appendText('• ');
			placeholderDiv.createEl('code', { text: placeholder.code });
			placeholderDiv.appendText(` - ${placeholder.desc}`);
			placeholderDiv.createEl('br');
		});
		
		placeholderDiv.createEl('br');
		placeholderDiv.createEl('strong', { text: 'Example: ' });
		placeholderDiv.appendText('"📝 %activity_type% %active_note_name% in %vault_name%"');
	}

	private renderCustomButton() {
		const { containerEl } = this;

		containerEl.createEl('h3', { text: 'Custom Button' });

		new Setting(containerEl)
			.setName('Enable custom button')
			.setDesc('Add a custom button to your Discord profile that others can click')
			.addToggle(toggle => toggle
				.setValue(this.settings.enableCustomButton)
				.onChange(async (value) => {
					this.settings.enableCustomButton = value;
					await this.callbacks.onSettingsChange(this.settings);
					this.displayWithScrollPreservation();
				}));

		if (this.settings.enableCustomButton) {
			this.renderCustomButtonFields();
		}
	}

	private renderCustomButtonFields() {
		const { containerEl } = this;

		new Setting(containerEl)
			.setName('Button label')
			.setDesc('Text shown on the button (max 32 characters)')
			.addText(text => text
				.setPlaceholder('Visit My Website')
				.setValue(this.settings.customButtonLabel)
				.onChange(async (value) => {
					if (value.length <= 32) {
						this.settings.customButtonLabel = value;
						await this.callbacks.onSettingsChange(this.settings);
					} else {
						text.setValue(this.settings.customButtonLabel);
						new Notice('Button label must be 32 characters or less');
					}
				}));

		new Setting(containerEl)
			.setName('Button URL')
			.setDesc('Website URL that opens when the button is clicked')
			.addText(text => text
				.setPlaceholder('https://example.com')
				.setValue(this.settings.customButtonUrl)
				.onChange(async (value) => {
					if (value === '' || value.startsWith('http://') || value.startsWith('https://')) {
						this.settings.customButtonUrl = value;
						await this.callbacks.onSettingsChange(this.settings);
					} else {
						new Notice('URL must start with http:// or https://');
					}
				}));

		const buttonHelpDiv = containerEl.createDiv('discord-rpc-button-help');
		buttonHelpDiv.createEl('strong', { text: 'Note: ' });
		buttonHelpDiv.appendText('The custom button will appear on your Discord profile when enabled.');
		buttonHelpDiv.createEl('br');
		buttonHelpDiv.appendText('Other Discord users can click this button to visit your website.');
	}

	private renderHelpSection() {
		const { containerEl } = this;

		const helpDiv = containerEl.createDiv('discord-rpc-main-help');
		helpDiv.createEl('h4', { text: 'Contributing' });
		
		const p1 = helpDiv.createEl('p');
		p1.appendText('Found a bug or have a feature request? ');
		p1.createEl('a', {
			text: 'Open an issue',
			href: 'https://github.com/Ray-kong/Obsidian-Customize-DiscordRPC/issues'
		});
		p1.appendText(' on GitHub!');
		
		const p2 = helpDiv.createEl('p');
		p2.appendText('Pull requests are welcome! Check out the ');
		p2.createEl('a', {
			text: 'repository',
			href: 'https://github.com/Ray-kong/Obsidian-Customize-DiscordRPC'
		});
		p2.appendText(' to contribute.');
		
		const p3 = helpDiv.createEl('p', { cls: 'discord-rpc-star-link' });
		p3.createEl('a', {
			text: '⭐ Star the project on GitHub',
			href: 'https://github.com/Ray-kong/Obsidian-Customize-DiscordRPC',
			cls: 'discord-rpc-star-button'
		});
	}

	private setupPathSuggestions(inputEl: HTMLInputElement) {
		const files = this.app.vault.getAllLoadedFiles();
		const paths: string[] = [];
		
		files.forEach(file => {
			if (file instanceof TFile) {
				paths.push(file.path);
				const folderPath = file.path.substring(0, file.path.lastIndexOf('/') + 1);
				if (folderPath && !paths.includes(folderPath)) {
					paths.push(folderPath);
				}
			} else {
				paths.push(file.path + '/');
			}
		});

		const datalistId = `path-suggestions-${Math.random().toString(36).substring(2, 11)}`;
		const datalist = document.createElement('datalist');
		datalist.id = datalistId;
		
		paths.sort().forEach(path => {
			const option = document.createElement('option');
			option.value = path;
			datalist.appendChild(option);
		});
		
		inputEl.setAttribute('list', datalistId);
		inputEl.parentElement?.appendChild(datalist);
		
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.removedNodes.forEach((node) => {
					if (node === inputEl) {
						datalist.remove();
						observer.disconnect();
					}
				});
			});
		});
		
		if (inputEl.parentElement) {
			observer.observe(inputEl.parentElement, { childList: true, subtree: true });
		}
	}

	private displayWithScrollPreservation() {
		const scrollContainer = this.containerEl.closest('.modal-content, .vertical-tab-content') as HTMLElement || 
			this.containerEl.parentElement ||
			document.documentElement;
		
		const scrollTop = scrollContainer.scrollTop;
		
		this.display();
		
		requestAnimationFrame(() => {
			scrollContainer.scrollTop = scrollTop;
		});
	}
}