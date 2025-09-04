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

		// Connection status
		const statusDiv = containerEl.createDiv('status-container');
		statusDiv.style.padding = '10px';
		statusDiv.style.marginBottom = '20px';
		statusDiv.style.border = '1px solid var(--background-modifier-border)';
		statusDiv.style.borderRadius = '5px';
		
		const statusText = statusDiv.createEl('div');
		const isConnected = this.callbacks.isConnected();
		statusText.innerHTML = `<strong>Status:</strong> ${isConnected ? 
			'<span style="color: var(--text-success)">✓ Connected to Discord</span>' : 
			'<span style="color: var(--text-error)">✗ Not connected to Discord</span>'}`;

		// Connect/Disconnect button
		new Setting(containerEl)
			.setName('Discord Rich Presence')
			.setDesc('Enable or disable Discord Rich Presence')
			.addButton(button => {
				button
					.setButtonText(this.callbacks.isEnabled() ? 'Disconnect' : 'Connect')
					.setCta()
					.onClick(async () => {
						await this.callbacks.onToggleConnection();
						// Refresh the settings display
						this.displayWithScrollPreservation();
					});
			});
	}

	private renderDisplayOptions() {
		const { containerEl } = this;

		containerEl.createEl('h3', { text: 'Display Options' });

		// Show file name
		new Setting(containerEl)
			.setName('Show file name')
			.setDesc('Display the name of the currently open file')
			.addToggle(toggle => toggle
				.setValue(this.settings.showFileName)
				.onChange(async (value) => {
					this.settings.showFileName = value;
					await this.callbacks.onSettingsChange(this.settings);
				}));

		// Show vault name
		new Setting(containerEl)
			.setName('Show vault name')
			.setDesc('Display the name of the current vault')
			.addToggle(toggle => toggle
				.setValue(this.settings.showVaultName)
				.onChange(async (value) => {
					this.settings.showVaultName = value;
					await this.callbacks.onSettingsChange(this.settings);
				}));

		// Time tracking mode
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

		// Hide vault name
		new Setting(containerEl)
			.setName('Hide vault name')
			.setDesc('Hide the actual vault name and show generic text instead')
			.addToggle(toggle => toggle
				.setValue(this.settings.hideVaultName)
				.onChange(async (value) => {
					this.settings.hideVaultName = value;
					await this.callbacks.onSettingsChange(this.settings);
				}));

		// Hide note name
		new Setting(containerEl)
			.setName('Hide note name')
			.setDesc('Hide specific note names and show generic "a document" instead')
			.addToggle(toggle => toggle
				.setValue(this.settings.hideNoteName)
				.onChange(async (value) => {
					this.settings.hideNoteName = value;
					await this.callbacks.onSettingsChange(this.settings);
				}));

		// Hide specific paths
		new Setting(containerEl)
			.setName('Hide specific files/folders')
			.setDesc('Hide notes that match exact paths or entire folders')
			.addToggle(toggle => toggle
				.setValue(this.settings.hideSpecificPaths)
				.onChange(async (value) => {
					this.settings.hideSpecificPaths = value;
					await this.callbacks.onSettingsChange(this.settings);
					// Refresh to show/hide the text area
					this.displayWithScrollPreservation();
				}));

		if (this.settings.hideSpecificPaths) {
			this.renderHiddenPaths();
		}
	}

	private renderHiddenPaths() {
		const { containerEl } = this;

		// Display existing hidden paths
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
					
					// Enable autocomplete with datalist
					this.setupPathSuggestions(text.inputEl);
				})
				.addButton(button => {
					button.setButtonText('Remove')
						.onClick(async () => {
							this.settings.hiddenPaths.splice(index, 1);
							await this.callbacks.onSettingsChange(this.settings);
							this.displayWithScrollPreservation(); // Refresh the settings
						});
				});
		});

		// Add new path button
		new Setting(containerEl)
			.setName('Add hidden path')
			.setDesc('Add a new file, folder, or pattern to hide')
			.addButton(button => {
				button.setButtonText('Add path')
					.setCta()
					.onClick(async () => {
						this.settings.hiddenPaths.push('');
						await this.callbacks.onSettingsChange(this.settings);
						this.displayWithScrollPreservation(); // Refresh the settings
					});
			});

		// Help text for patterns
		const helpDiv = containerEl.createDiv();
		helpDiv.style.fontSize = '0.8em';
		helpDiv.style.color = 'var(--text-muted)';
		helpDiv.style.marginTop = '10px';
		helpDiv.style.padding = '8px';
		helpDiv.style.backgroundColor = 'var(--background-secondary)';
		helpDiv.style.borderRadius = '4px';
		helpDiv.innerHTML = `
			<strong>Pattern Examples:</strong><br>
			• <code>Private/</code> - Hide all files in Private folder<br>
			• <code>Personal/Diary.md</code> - Hide specific file in folder<br>
			• <code>MyDiary.md</code> - Hide specific file in root<br>
			• <code>Work/</code> - Hide all files in Work folder<br>
			<em>Tip: Start typing to see file/folder suggestions</em>
		`;
	}

	private renderCustomTemplates() {
		const { containerEl } = this;

		containerEl.createEl('h3', { text: 'Custom Text Templates' });

		// Use custom templates
		new Setting(containerEl)
			.setName('Use custom templates')
			.setDesc('Create fully customizable presence text with placeholders')
			.addToggle(toggle => toggle
				.setValue(this.settings.useCustomTemplate)
				.onChange(async (value) => {
					this.settings.useCustomTemplate = value;
					await this.callbacks.onSettingsChange(this.settings);
					// Refresh to show/hide custom template fields
					this.displayWithScrollPreservation();
				}));

		if (this.settings.useCustomTemplate) {
			this.renderTemplateFields();
		}
	}

	private renderTemplateFields() {
		const { containerEl } = this;

		// Custom details template
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
				text.inputEl.style.width = '100%';
			});

		// Custom state template  
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
				text.inputEl.style.width = '100%';
			});

		// Available placeholders help
		const placeholderDiv = containerEl.createDiv();
		placeholderDiv.style.fontSize = '0.85em';
		placeholderDiv.style.color = 'var(--text-muted)';
		placeholderDiv.style.marginTop = '10px';
		placeholderDiv.style.padding = '10px';
		placeholderDiv.style.backgroundColor = 'var(--background-secondary)';
		placeholderDiv.style.borderRadius = '4px';
		placeholderDiv.innerHTML = `
			<strong>Available Placeholders:</strong><br>
			• <code>%activity_type%</code> - "Reading" or "Editing" based on current mode<br>
			• <code>%active_note_name%</code> - Current note name<br>
			• <code>%active_note_path%</code> - Full path to current note<br>
			• <code>%vault_name%</code> - Vault name<br>
			• <code>%folder_name%</code> - Current note's folder<br>
			• <code>%file_extension%</code> - File extension (md, txt, etc.)<br>
			• <code>%workspace_name%</code> - Same as vault name<br><br>
			<strong>Example:</strong> "📝 %activity_type% %active_note_name% in %vault_name%"
		`;
	}

	private renderCustomButton() {
		const { containerEl } = this;

		containerEl.createEl('h3', { text: 'Custom Button' });

		// Enable custom button
		new Setting(containerEl)
			.setName('Enable custom button')
			.setDesc('Add a custom button to your Discord profile that others can click')
			.addToggle(toggle => toggle
				.setValue(this.settings.enableCustomButton)
				.onChange(async (value) => {
					this.settings.enableCustomButton = value;
					await this.callbacks.onSettingsChange(this.settings);
					// Refresh to show/hide custom button fields
					this.displayWithScrollPreservation();
				}));

		if (this.settings.enableCustomButton) {
			this.renderCustomButtonFields();
		}
	}

	private renderCustomButtonFields() {
		const { containerEl } = this;

		// Custom button label
		new Setting(containerEl)
			.setName('Button label')
			.setDesc('Text shown on the button (max 32 characters)')
			.addText(text => text
				.setPlaceholder('Visit My Website')
				.setValue(this.settings.customButtonLabel)
				.onChange(async (value) => {
					// Discord has a 32 character limit for button labels
					if (value.length <= 32) {
						this.settings.customButtonLabel = value;
						await this.callbacks.onSettingsChange(this.settings);
					} else {
						text.setValue(this.settings.customButtonLabel);
						new Notice('Button label must be 32 characters or less');
					}
				}));

		// Custom button URL
		new Setting(containerEl)
			.setName('Button URL')
			.setDesc('Website URL that opens when the button is clicked')
			.addText(text => text
				.setPlaceholder('https://example.com')
				.setValue(this.settings.customButtonUrl)
				.onChange(async (value) => {
					// Basic URL validation
					if (value === '' || value.startsWith('http://') || value.startsWith('https://')) {
						this.settings.customButtonUrl = value;
						await this.callbacks.onSettingsChange(this.settings);
					} else {
						new Notice('URL must start with http:// or https://');
					}
				}));

		// Help text for custom button
		const buttonHelpDiv = containerEl.createDiv();
		buttonHelpDiv.style.fontSize = '0.8em';
		buttonHelpDiv.style.color = 'var(--text-muted)';
		buttonHelpDiv.style.marginTop = '10px';
		buttonHelpDiv.style.padding = '8px';
		buttonHelpDiv.style.backgroundColor = 'var(--background-secondary)';
		buttonHelpDiv.style.borderRadius = '4px';
		buttonHelpDiv.innerHTML = `
			<strong>Note:</strong> The custom button will appear on your Discord profile when enabled.<br>
			Other Discord users can click this button to visit your website.
		`;
	}

	private renderHelpSection() {
		const { containerEl } = this;

		// Help text
		const helpDiv = containerEl.createDiv();
		helpDiv.style.marginTop = '30px';
		helpDiv.style.padding = '10px';
		helpDiv.style.backgroundColor = 'var(--background-secondary)';
		helpDiv.style.borderRadius = '5px';
		helpDiv.innerHTML = `
			<h4>Contributing</h4>
			<p>Found a bug or have a feature request? <a href="https://github.com/Ray-kong/Obsidian-Customize-DiscordRPC/issues">Open an issue</a> on GitHub!</p>
			<p>Pull requests are welcome! Check out the <a href="https://github.com/Ray-kong/Obsidian-Customize-DiscordRPC">repository</a> to contribute.</p>
			<p style="margin-top: 10px; text-align: center;">
				<a href="https://github.com/Ray-kong/Obsidian-Customize-DiscordRPC" style="color: var(--text-accent);">
					⭐ Star the project on GitHub
				</a>
			</p>
		`;
	}

	private setupPathSuggestions(inputEl: HTMLInputElement) {
		// Get all files and folders in the vault
		const files = this.app.vault.getAllLoadedFiles();
		const paths: string[] = [];
		
		files.forEach(file => {
			// Add file paths
			if (file instanceof TFile) {
				paths.push(file.path);
				// Add folder paths for files
				const folderPath = file.path.substring(0, file.path.lastIndexOf('/') + 1);
				if (folderPath && !paths.includes(folderPath)) {
					paths.push(folderPath);
				}
			} else {
				// Add folder paths
				paths.push(file.path + '/');
			}
		});

		// Create datalist element for autocomplete
		const datalistId = `path-suggestions-${Math.random().toString(36).substring(2, 11)}`;
		const datalist = document.createElement('datalist');
		datalist.id = datalistId;
		
		paths.sort().forEach(path => {
			const option = document.createElement('option');
			option.value = path;
			datalist.appendChild(option);
		});
		
		// Set up the input element
		inputEl.setAttribute('list', datalistId);
		inputEl.parentElement?.appendChild(datalist);
		
		// Clean up datalist when input is removed
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
		// Find the scrollable container (could be the modal or a parent container)
		const scrollContainer = this.containerEl.closest('.modal-content, .vertical-tab-content') as HTMLElement || 
			this.containerEl.parentElement ||
			document.documentElement;
		
		// Save current scroll position
		const scrollTop = scrollContainer.scrollTop;
		
		// Rebuild the display
		this.display();
		
		// Restore scroll position after DOM updates
		requestAnimationFrame(() => {
			scrollContainer.scrollTop = scrollTop;
		});
	}
}