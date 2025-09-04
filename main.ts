import { App, Plugin, PluginSettingTab, Setting, Notice, TFile } from 'obsidian';

// @ts-ignore
import * as DiscordRPC from 'discord-rpc';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Type definitions for Discord RPC
interface DiscordRPCClient {
	on(event: string, callback: () => void): void;
	login(options: { clientId: string }): Promise<void>;
	setActivity(activity: DiscordActivity): Promise<void>;
	clearActivity(): Promise<void>;
	destroy(): Promise<void>;
}

interface DiscordActivity {
	largeImageKey?: string;
	largeImageText?: string;
	smallImageKey?: string;
	smallImageText?: string;
	instance?: boolean;
	details?: string;
	state?: string;
	startTimestamp?: number;
	buttons?: Array<{
		label: string;
		url: string;
	}>;
}

interface DiscordRPCSettings {
	enabled: boolean;
	showFileName: boolean;
	showVaultName: boolean;
	timeMode: 'file' | 'session';
	// Template system
	useCustomTemplate: boolean;
	customDetailsTemplate: string;
	customStateTemplate: string;
	// Custom buttons
	enableCustomButton: boolean;
	customButtonLabel: string;
	customButtonUrl: string;
	// Privacy settings
	hideVaultName: boolean;
	hideNoteName: boolean;
	hideSpecificPaths: boolean;
	hiddenPaths: string[];
}

const DEFAULT_SETTINGS: DiscordRPCSettings = {
	enabled: false,
	showFileName: true,
	showVaultName: true,
	timeMode: 'file',
	// Template system
	useCustomTemplate: false,
	customDetailsTemplate: '%activity_type%: %active_note_name%',
	customStateTemplate: 'Vault: %vault_name%',
	// Custom buttons
	enableCustomButton: false,
	customButtonLabel: 'Visit My Website',
	customButtonUrl: '',
	// Privacy settings
	hideVaultName: false,
	hideNoteName: false,
	hideSpecificPaths: false,
	hiddenPaths: []
}

export default class ObsidianDiscordRPC extends Plugin {
	settings: DiscordRPCSettings;
	private rpc: DiscordRPCClient | null = null;
	connected = false;
	private statusBarItem: HTMLElement;
	private currentFile: TFile | null = null;
	private startTime: number = Date.now();
	private sessionStartTime: number = Date.now();
	private clientId = process.env.DISCORD_CLIENT_ID || '763813185022197831'; // Use env variable or fallback to default
	updateInterval: NodeJS.Timer | null = null;

	async onload() {
		await this.loadSettings();
		
		// Add status bar item
		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar();

		// Initialize Discord RPC if enabled
		if (this.settings.enabled) {
			await this.connectDiscord();
		}

		// Register events
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				this.handleActiveLeafChange();
			})
		);

		this.registerEvent(
			this.app.workspace.on('file-open', (file: TFile) => {
				this.handleFileOpen(file);
			})
		);

		this.registerEvent(
			this.app.vault.on('rename', (file) => {
				if (file instanceof TFile && this.currentFile && file.path === this.currentFile.path) {
					this.updatePresence();
				}
			})
		);

		// Listen for layout changes which include reading/editing mode switches
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				// Small delay to ensure the layout has fully changed
				setTimeout(() => {
					this.updatePresence();
				}, 100);
			})
		);

		// Add settings tab
		this.addSettingTab(new DiscordRPCSettingTab(this.app, this));

		// Add command to toggle Discord RPC
		this.addCommand({
			id: 'toggle-discord-rpc',
			name: 'Toggle Discord Rich Presence',
			callback: async () => {
				if (this.connected) {
					await this.disconnectDiscord();
					new Notice('Discord Rich Presence disconnected');
				} else {
					await this.connectDiscord();
					if (this.connected) {
						new Notice('Discord Rich Presence connected');
					}
				}
			}
		});
	}

	onunload() {
		this.disconnectDiscord();
	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		
		// Migrate old settings format
		let needsMigration = false;
		if (data) {
			const oldData = data as Record<string, unknown>;
			
			// Remove deprecated showTimeElapsed setting
			if ('showTimeElapsed' in oldData) {
				delete oldData.showTimeElapsed;
				needsMigration = true;
			}
			
			// Remove deprecated custom prefix settings
			if ('useCustomDetails' in oldData) {
				delete oldData.useCustomDetails;
				needsMigration = true;
			}
			if ('customDetailsPrefix' in oldData) {
				delete oldData.customDetailsPrefix;
				needsMigration = true;
			}
			if ('customStatePrefix' in oldData) {
				delete oldData.customStatePrefix;
				needsMigration = true;
			}
			if ('customDetails' in oldData) {
				delete oldData.customDetails;
				needsMigration = true;
			}
			if ('customState' in oldData) {
				delete oldData.customState;
				needsMigration = true;
			}
			
			if (needsMigration) {
				await this.saveSettings();
			}
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
		
		// Handle connection state change
		if (this.settings.enabled && !this.connected) {
			await this.connectDiscord();
		} else if (!this.settings.enabled && this.connected) {
			await this.disconnectDiscord();
		} else if (this.connected) {
			// Update presence with new settings
			this.updatePresence();
		}
	}

	async connectDiscord() {
		if (this.connected) return;

		try {
			this.rpc = new DiscordRPC.Client({ transport: 'ipc' }) as DiscordRPCClient;
			
			this.rpc.on('ready', () => {
				console.log('Discord RPC connected');
				this.connected = true;
				this.settings.enabled = true;
				this.saveSettings();
				this.updateStatusBar();
				this.updatePresence();
				
				// Set up periodic presence updates for elapsed time (always enabled)
				this.updateInterval = setInterval(() => {
					if (this.connected) {
						this.updatePresence();
					}
				}, 15000); // Update every 15 seconds
			});

			this.rpc.on('disconnected', () => {
				console.log('Discord RPC disconnected');
				this.connected = false;
				this.updateStatusBar();
				if (this.updateInterval) {
					clearInterval(this.updateInterval);
					this.updateInterval = null;
				}
			});

			await this.rpc.login({ clientId: this.clientId });
		} catch (error) {
			console.error('Failed to connect to Discord:', error);
			new Notice('Failed to connect to Discord. Is Discord running?');
			this.connected = false;
			this.settings.enabled = false;
			await this.saveSettings();
			this.updateStatusBar();
		}
	}

	async disconnectDiscord() {
		if (!this.connected || !this.rpc) return;

		try {
			if (this.updateInterval) {
				clearInterval(this.updateInterval);
				this.updateInterval = null;
			}
			
			await this.rpc.clearActivity();
			await this.rpc.destroy();
			this.rpc = null;
			this.connected = false;
			this.settings.enabled = false;
			await this.saveSettings();
			this.updateStatusBar();
		} catch (error) {
			console.error('Error disconnecting Discord RPC:', error);
		}
	}

	private handleActiveLeafChange() {
		const file = this.app.workspace.getActiveFile();
		if (file) {
			this.handleFileOpen(file);
		}
	}

	private handleFileOpen(file: TFile | null) {
		if (file !== this.currentFile) {
			this.currentFile = file;
			this.startTime = Date.now();
			this.updatePresence();
		}
	}

	private isPathHidden(filePath: string): boolean {
		if (!this.settings.hideSpecificPaths || this.settings.hiddenPaths.length === 0) {
			return false;
		}

		return this.settings.hiddenPaths.some(pattern => {
			// Remove leading/trailing whitespace
			pattern = pattern.trim();
			if (!pattern) return false;

			// Handle exact path match
			if (pattern === filePath) return true;

			// Handle folder patterns (ending with /)
			if (pattern.endsWith('/')) {
				return filePath.startsWith(pattern);
			}

			// No other patterns supported
			return false;
		});
	}

	private isInReadingMode(): boolean {
		try {
			const activeLeaf = this.app.workspace.activeLeaf;
			if (!activeLeaf) return false;
			
			const view = activeLeaf.view;
			if (!view) return false;
			
			// Check if it's a markdown view and in reading mode
			if (view.getViewType() === 'markdown') {
				const markdownView = view as { currentMode?: { type: string } };
				return markdownView.currentMode?.type === 'preview';
			}
			
			return false;
		} catch (error) {
			console.error('Error checking reading mode:', error);
			return false;
		}
	}

	private processTemplate(template: string): string {
		if (!template) return '';

		let result = template;
		const isReading = this.isInReadingMode();
		console.log('Discord RPC: Processing template:', template, 'Reading mode:', isReading);

		// Available placeholders
		const placeholders = {
			'%active_note_name%': this.currentFile ? this.currentFile.basename : 'Unknown',
			'%active_note_path%': this.currentFile ? this.currentFile.path : '',
			'%vault_name%': this.app.vault.getName(),
			'%folder_name%': this.currentFile ? this.currentFile.parent?.name || 'Root' : 'Unknown',
			'%file_extension%': this.currentFile ? this.currentFile.extension : '',
			'%workspace_name%': this.app.vault.getName(), // Alias for vault_name
			'%activity_type%': isReading ? 'Reading' : 'Editing',
		};

		// Replace all placeholders
		Object.entries(placeholders).forEach(([placeholder, value]) => {
			result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
		});

		console.log('Discord RPC: Processed template result:', result);
		return result;
	}

	updatePresence() {
		if (!this.connected || !this.rpc) {
			console.log('Discord RPC: Not connected or RPC client not available');
			return;
		}

		try {
			console.log('Discord RPC: Updating presence...');
			const activity: DiscordActivity = {
				largeImageKey: 'obsidian',
				largeImageText: 'Obsidian - A knowledge base',
				smallImageKey: 'obsidian_small',
				smallImageText: 'Taking notes',
				instance: false
			};

			// Check privacy settings
			const shouldHideFile = this.currentFile && (
				this.settings.hideNoteName || 
				this.isPathHidden(this.currentFile.path)
			);
			const shouldHideVault = this.settings.hideVaultName;

			// Set details (top line) - only if not hiding file info
			if (!shouldHideFile) {
				if (this.settings.useCustomTemplate && this.settings.customDetailsTemplate) {
					activity.details = this.processTemplate(this.settings.customDetailsTemplate);
					console.log('Discord RPC: Using custom template for details:', activity.details);
				} else {
					// Default fallback when not using templates - detect reading/editing mode
					const isReading = this.isInReadingMode();
					const activityType = isReading ? 'Reading' : 'Editing';
					
					if (this.currentFile && this.settings.showFileName) {
						activity.details = `${activityType}: ${this.currentFile.basename}`;
					} else {
						activity.details = `${activityType} a note`;
					}
					console.log('Discord RPC: Using default details:', activity.details);
				}
			} else {
				console.log('Discord RPC: File info hidden, no details set');
			}

			// Set state (bottom line) - only if not hiding vault info
			if (this.settings.showVaultName && !shouldHideVault) {
				if (this.settings.useCustomTemplate && this.settings.customStateTemplate) {
					activity.state = this.processTemplate(this.settings.customStateTemplate);
					console.log('Discord RPC: Using custom template for state:', activity.state);
				} else {
					// Default fallback when not using templates
					const vaultName = this.app.vault.getName();
					activity.state = `Vault: ${vaultName}`;
					console.log('Discord RPC: Using default state:', activity.state);
				}
			} else {
				console.log('Discord RPC: Vault info hidden or disabled, no state set');
			}

			// Add timestamp for elapsed time (always shown)
			const timeToUse = this.settings.timeMode === 'session' ? this.sessionStartTime : this.startTime;
			activity.startTimestamp = Math.floor(timeToUse / 1000);

			// Add buttons
			const buttons: Array<{ label: string; url: string }> = [];
			
			// Add custom button if enabled and configured
			if (this.settings.enableCustomButton && this.settings.customButtonUrl) {
				buttons.push({
					label: this.settings.customButtonLabel || 'Visit My Website',
					url: this.settings.customButtonUrl
				});
			}
			
			if (buttons.length > 0) {
				activity.buttons = buttons;
			}

			console.log('Discord RPC: Setting activity:', activity);
			this.rpc.setActivity(activity);
		} catch (error) {
			console.error('Failed to update Discord presence:', error);
		}
	}

	private updateStatusBar() {
		if (this.statusBarItem) {
			const status = this.connected ? '🟢' : '🔴';
			this.statusBarItem.setText(status);
			this.statusBarItem.title = this.connected ? 'Discord RPC Connected - Click to disconnect' : 'Discord RPC Disconnected - Click to connect';
			
			// Add click handler
			this.statusBarItem.onclick = async () => {
				if (this.connected) {
					await this.disconnectDiscord();
					new Notice('Discord Rich Presence disconnected');
				} else {
					await this.connectDiscord();
					if (this.connected) {
						new Notice('Discord Rich Presence connected');
					}
				}
			};
		}
	}
}

class DiscordRPCSettingTab extends PluginSettingTab {
	plugin: ObsidianDiscordRPC;

	constructor(app: App, plugin: ObsidianDiscordRPC) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Discord Rich Presence Settings' });

		// Connection status
		const statusDiv = containerEl.createDiv('status-container');
		statusDiv.style.padding = '10px';
		statusDiv.style.marginBottom = '20px';
		statusDiv.style.border = '1px solid var(--background-modifier-border)';
		statusDiv.style.borderRadius = '5px';
		
		const statusText = statusDiv.createEl('div');
		const isConnected = this.plugin.connected;
		statusText.innerHTML = `<strong>Status:</strong> ${isConnected ? 
			'<span style="color: var(--text-success)">✓ Connected to Discord</span>' : 
			'<span style="color: var(--text-error)">✗ Not connected to Discord</span>'}`;

		// Connect/Disconnect button
		new Setting(containerEl)
			.setName('Discord Rich Presence')
			.setDesc('Enable or disable Discord Rich Presence')
			.addButton(button => {
				button
					.setButtonText(this.plugin.settings.enabled ? 'Disconnect' : 'Connect')
					.setCta()
					.onClick(async () => {
						if (this.plugin.settings.enabled) {
							await this.plugin.disconnectDiscord();
							new Notice('Discord Rich Presence disconnected');
						} else {
							this.plugin.settings.enabled = true;
							await this.plugin.saveSettings();
							if (this.plugin.connected) {
								new Notice('Discord Rich Presence connected');
							}
						}
						// Refresh the settings display
						this.displayWithScrollPreservation();
					});
			});

		containerEl.createEl('h3', { text: 'Display Options' });

		// Show file name
		new Setting(containerEl)
			.setName('Show file name')
			.setDesc('Display the name of the currently open file')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showFileName)
				.onChange(async (value) => {
					this.plugin.settings.showFileName = value;
					await this.plugin.saveSettings();
				}));

		// Show vault name
		new Setting(containerEl)
			.setName('Show vault name')
			.setDesc('Display the name of the current vault')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showVaultName)
				.onChange(async (value) => {
					this.plugin.settings.showVaultName = value;
					await this.plugin.saveSettings();
				}));

		// Time tracking mode
		new Setting(containerEl)
			.setName('Time tracking mode')
			.setDesc('Choose between showing time for current file or entire session')
			.addDropdown(dropdown => dropdown
				.addOption('file', 'Current file time')
				.addOption('session', 'Session time')
				.setValue(this.plugin.settings.timeMode)
				.onChange(async (value: 'file' | 'session') => {
					this.plugin.settings.timeMode = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Privacy Settings' });

		// Hide vault name
		new Setting(containerEl)
			.setName('Hide vault name')
			.setDesc('Hide the actual vault name and show generic text instead')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hideVaultName)
				.onChange(async (value) => {
					this.plugin.settings.hideVaultName = value;
					await this.plugin.saveSettings();
				}));

		// Hide note name
		new Setting(containerEl)
			.setName('Hide note name')
			.setDesc('Hide specific note names and show generic "a document" instead')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hideNoteName)
				.onChange(async (value) => {
					this.plugin.settings.hideNoteName = value;
					await this.plugin.saveSettings();
				}));

		// Hide specific paths
		new Setting(containerEl)
			.setName('Hide specific files/folders')
			.setDesc('Hide notes that match exact paths or entire folders')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hideSpecificPaths)
				.onChange(async (value) => {
					this.plugin.settings.hideSpecificPaths = value;
					await this.plugin.saveSettings();
					// Refresh to show/hide the text area
					this.displayWithScrollPreservation();
				}));

		if (this.plugin.settings.hideSpecificPaths) {
			// Display existing hidden paths
			this.plugin.settings.hiddenPaths.forEach((path, index) => {
				new Setting(containerEl)
					.setName(`Hidden path ${index + 1}`)
					.setDesc('Exact file path or folder path to hide')
					.addText(text => {
						text.setPlaceholder('e.g., Private/, Personal/Diary.md, MyNotes.md')
							.setValue(path)
							.onChange(async (value) => {
								this.plugin.settings.hiddenPaths[index] = value.trim();
								await this.plugin.saveSettings();
							});
						
						// Enable autocomplete with datalist
						this.setupPathSuggestions(text.inputEl);
					})
					.addButton(button => {
						button.setButtonText('Remove')
							.onClick(async () => {
								this.plugin.settings.hiddenPaths.splice(index, 1);
								await this.plugin.saveSettings();
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
							this.plugin.settings.hiddenPaths.push('');
							await this.plugin.saveSettings();
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

		containerEl.createEl('h3', { text: 'Custom Text Templates' });

		// Use custom templates
		new Setting(containerEl)
			.setName('Use custom templates')
			.setDesc('Create fully customizable presence text with placeholders')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useCustomTemplate)
				.onChange(async (value) => {
					this.plugin.settings.useCustomTemplate = value;
					await this.plugin.saveSettings();
					// Refresh to show/hide custom template fields
					this.displayWithScrollPreservation();
				}));

		if (this.plugin.settings.useCustomTemplate) {
			// Custom details template
			new Setting(containerEl)
				.setName('Activity text template')
				.setDesc('Template for the top line of Discord presence')
				.addTextArea(text => {
					text.setPlaceholder('Example: %activity_type% %active_note_name% in %folder_name%/')
						.setValue(this.plugin.settings.customDetailsTemplate)
						.onChange(async (value) => {
							this.plugin.settings.customDetailsTemplate = value;
							await this.plugin.saveSettings();
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
						.setValue(this.plugin.settings.customStateTemplate)
						.onChange(async (value) => {
							this.plugin.settings.customStateTemplate = value;
							await this.plugin.saveSettings();
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

		containerEl.createEl('h3', { text: 'Custom Button' });

		// Enable custom button
		new Setting(containerEl)
			.setName('Enable custom button')
			.setDesc('Add a custom button to your Discord profile that others can click')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCustomButton)
				.onChange(async (value) => {
					this.plugin.settings.enableCustomButton = value;
					await this.plugin.saveSettings();
					// Refresh to show/hide custom button fields
					this.displayWithScrollPreservation();
				}));

		if (this.plugin.settings.enableCustomButton) {
			// Custom button label
			new Setting(containerEl)
				.setName('Button label')
				.setDesc('Text shown on the button (max 32 characters)')
				.addText(text => text
					.setPlaceholder('Visit My Website')
					.setValue(this.plugin.settings.customButtonLabel)
					.onChange(async (value) => {
						// Discord has a 32 character limit for button labels
						if (value.length <= 32) {
							this.plugin.settings.customButtonLabel = value;
							await this.plugin.saveSettings();
						} else {
							text.setValue(this.plugin.settings.customButtonLabel);
							new Notice('Button label must be 32 characters or less');
						}
					}));

			// Custom button URL
			new Setting(containerEl)
				.setName('Button URL')
				.setDesc('Website URL that opens when the button is clicked')
				.addText(text => text
					.setPlaceholder('https://example.com')
					.setValue(this.plugin.settings.customButtonUrl)
					.onChange(async (value) => {
						// Basic URL validation
						if (value === '' || value.startsWith('http://') || value.startsWith('https://')) {
							this.plugin.settings.customButtonUrl = value;
							await this.plugin.saveSettings();
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