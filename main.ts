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
	customDetailsPrefix: string;
	customStatePrefix: string;
	useCustomDetails: boolean;
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
	customDetailsPrefix: 'Editing',
	customStatePrefix: 'Vault',
	useCustomDetails: false,
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

		// Add command to reconnect
		this.addCommand({
			id: 'reconnect-discord-rpc',
			name: 'Reconnect Discord Rich Presence',
			callback: async () => {
				await this.disconnectDiscord();
				await this.connectDiscord();
				if (this.connected) {
					new Notice('Discord Rich Presence reconnected');
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
		if (data && 'showTimeElapsed' in data) {
			// If the old setting was false, default to 'file' mode
			// If it was true, keep the default 'file' mode
			const oldData = data as DiscordRPCSettings & { showTimeElapsed?: boolean };
			delete oldData.showTimeElapsed;
			await this.saveSettings();
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

			// Handle wildcard patterns
			if (pattern.includes('*')) {
				// Convert glob pattern to regex
				const regexPattern = pattern
					.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
					.replace(/\\\*/g, '.*'); // Convert * to .*
				const regex = new RegExp(`^${regexPattern}$`);
				return regex.test(filePath);
			}

			// Handle folder patterns (ending with /)
			if (pattern.endsWith('/')) {
				return filePath.startsWith(pattern);
			}

			// Handle prefix matching
			return filePath.includes(pattern);
		});
	}

	updatePresence() {
		if (!this.connected || !this.rpc) return;

		try {
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
				const detailsPrefix = this.settings.useCustomDetails && this.settings.customDetailsPrefix ? 
					this.settings.customDetailsPrefix : 'Editing';
				
				if (this.currentFile && this.settings.showFileName) {
					activity.details = `${detailsPrefix}: ${this.currentFile.basename}`;
				} else {
					activity.details = `${detailsPrefix} a note`;
				}
			}

			// Set state (bottom line) - only if not hiding vault info
			if (this.settings.showVaultName && !shouldHideVault) {
				const statePrefix = this.settings.useCustomDetails && this.settings.customStatePrefix ? 
					this.settings.customStatePrefix : 'Vault';
				const vaultName = this.app.vault.getName();
				activity.state = `${statePrefix}: ${vaultName}`;
			}

			// Add timestamp for elapsed time (always shown)
			const timeToUse = this.settings.timeMode === 'session' ? this.sessionStartTime : this.startTime;
			activity.startTimestamp = Math.floor(timeToUse / 1000);

			// Add buttons (optional - you can customize these)
			activity.buttons = [
				{
					label: 'Learn About Obsidian',
					url: 'https://obsidian.md'
				}
			];

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
			.setDesc('Hide notes that match certain paths or patterns')
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
					.setDesc('File path, folder path, or pattern to hide')
					.addText(text => {
						text.setPlaceholder('e.g., Private/, *.secret, Diary.md')
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
				• <code>*.secret</code> - Hide files ending with .secret<br>
				• <code>Personal/*</code> - Hide all files starting with Personal/<br>
				• <code>Diary.md</code> - Hide specific file<br>
				<em>Tip: Start typing to see file/folder suggestions</em>
			`;
		}

		containerEl.createEl('h3', { text: 'Custom Prefixes (Optional)' });

		// Use custom prefixes
		new Setting(containerEl)
			.setName('Use custom prefixes')
			.setDesc('Replace "Editing" and "Vault" with custom text')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useCustomDetails)
				.onChange(async (value) => {
					this.plugin.settings.useCustomDetails = value;
					await this.plugin.saveSettings();
					// Refresh to show/hide custom text fields
					this.displayWithScrollPreservation();
				}));

		if (this.plugin.settings.useCustomDetails) {
			// Custom details prefix
			new Setting(containerEl)
				.setName('Activity prefix')
				.setDesc('Replace "Editing" with custom text (e.g., "Working on", "Writing")')
				.addText(text => text
					.setPlaceholder('Editing')
					.setValue(this.plugin.settings.customDetailsPrefix)
					.onChange(async (value) => {
						this.plugin.settings.customDetailsPrefix = value;
						await this.plugin.saveSettings();
					}));

			// Custom state prefix
			new Setting(containerEl)
				.setName('Location prefix')
				.setDesc('Replace "Vault" with custom text (e.g., "Project", "Workspace")')
				.addText(text => text
					.setPlaceholder('Vault')
					.setValue(this.plugin.settings.customStatePrefix)
					.onChange(async (value) => {
						this.plugin.settings.customStatePrefix = value;
						await this.plugin.saveSettings();
					}));
		}

		// Help text
		const helpDiv = containerEl.createDiv();
		helpDiv.style.marginTop = '30px';
		helpDiv.style.padding = '10px';
		helpDiv.style.backgroundColor = 'var(--background-secondary)';
		helpDiv.style.borderRadius = '5px';
		helpDiv.createEl('h4', { text: 'Help' });
		helpDiv.createEl('p', { text: 'Make sure Discord is running on your computer for the Rich Presence to work.' });
		helpDiv.createEl('p', { text: 'The presence will update automatically when you switch between notes.' });
		helpDiv.createEl('p', { text: 'Use privacy settings to hide sensitive vault names, note names, or specific files/folders.' });
		helpDiv.createEl('p', { text: 'You can also use the command palette to toggle or reconnect the Discord Rich Presence.' });
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