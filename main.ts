import { Plugin, Notice, TFile } from 'obsidian';

import { DiscordRPCSettings } from './src/types/settings';
import { DEFAULT_SETTINGS } from './src/utils/constants';
import { DiscordClient } from './src/services/discord-client';
import { PresenceManager } from './src/services/presence-manager';
import { StatusBarManager } from './src/ui/status-bar';
import { DiscordRPCSettingTab, SettingsTabCallbacks } from './src/ui/settings-tab';

export default class ObsidianDiscordRPC extends Plugin {
	settings: DiscordRPCSettings;
	private discordClient: DiscordClient;
	private presenceManager: PresenceManager;
	private statusBarManager: StatusBarManager;
	private currentFile: TFile | null = null;

	async onload() {
		await this.loadSettings();
		
		// Initialize services
		this.discordClient = new DiscordClient();
		this.presenceManager = new PresenceManager(
			this.settings,
			this.app.vault,
			this.app.workspace,
			this.discordClient
		);

		// Initialize UI components
		const statusBarItem = this.addStatusBarItem();
		this.statusBarManager = new StatusBarManager(statusBarItem);
		this.updateStatusBar();

		// Set up Discord client callbacks
		this.discordClient.setCallbacks(
			() => this.onDiscordReady(),
			() => this.onDiscordDisconnected()
		);

		// Initialize Discord RPC if enabled
		if (this.settings.enabled) {
			await this.connectDiscord();
		}

		this.registerEventListeners();
		this.registerCommands();
		this.addSettingTab(this.createSettingTab());
	}

	onunload() {
		this.discordClient.disconnect();
	}

	private registerEventListeners() {
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
	}

	private registerCommands() {
		// Add command to toggle Discord RPC
		this.addCommand({
			id: 'toggle-discord-rpc',
			name: 'Toggle Discord Rich Presence',
			callback: async () => {
				await this.toggleConnection();
			}
		});

		// Add command to reconnect
		this.addCommand({
			id: 'reconnect-discord-rpc',
			name: 'Reconnect Discord Rich Presence',
			callback: async () => {
				await this.disconnectDiscord();
				await this.connectDiscord();
				if (this.discordClient.isConnected()) {
					new Notice('Discord Rich Presence reconnected');
				}
			}
		});
	}

	private createSettingTab(): DiscordRPCSettingTab {
		const callbacks: SettingsTabCallbacks = {
			onToggleConnection: () => this.toggleConnection(),
			onSettingsChange: (settings) => this.updateSettings(settings),
			isConnected: () => this.discordClient.isConnected(),
			isEnabled: () => this.settings.enabled
		};

		return new DiscordRPCSettingTab(this.app, this, this.settings, callbacks);
	}

	private async onDiscordReady() {
		this.settings.enabled = true;
		await this.saveSettings();
		this.updateStatusBar();
		this.updatePresence();
	}

	private onDiscordDisconnected() {
		this.updateStatusBar();
	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		
		// Migrate old settings format
		await this.migrateOldSettings(data);
	}

	private async migrateOldSettings(data: unknown) {
		let needsMigration = false;
		if (data) {
			const oldData = data as Record<string, unknown>;
			
			// Remove deprecated settings
			const deprecatedKeys = [
				'showTimeElapsed',
				'useCustomDetails',
				'customDetailsPrefix',
				'customStatePrefix',
				'customDetails',
				'customState'
			];

			deprecatedKeys.forEach(key => {
				if (key in oldData) {
					delete oldData[key];
					needsMigration = true;
				}
			});
			
			if (needsMigration) {
				await this.saveSettings();
			}
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async updateSettings(settings: DiscordRPCSettings) {
		this.settings = settings;
		this.presenceManager.updateSettings(settings);
		await this.saveSettings();
		
		// Handle connection state change
		if (this.settings.enabled && !this.discordClient.isConnected()) {
			await this.connectDiscord();
		} else if (!this.settings.enabled && this.discordClient.isConnected()) {
			await this.disconnectDiscord();
		} else if (this.discordClient.isConnected()) {
			// Update presence with new settings
			this.updatePresence();
		}
	}

	private async connectDiscord(): Promise<void> {
		const success = await this.discordClient.connect();
		if (!success) {
			this.settings.enabled = false;
			await this.saveSettings();
		}
		this.updateStatusBar();
	}

	private async disconnectDiscord(): Promise<void> {
		await this.discordClient.disconnect();
		this.settings.enabled = false;
		await this.saveSettings();
		this.updateStatusBar();
	}

	private async toggleConnection(): Promise<void> {
		if (this.discordClient.isConnected()) {
			await this.disconnectDiscord();
			new Notice('Discord Rich Presence disconnected');
		} else {
			await this.connectDiscord();
			if (this.discordClient.isConnected()) {
				new Notice('Discord Rich Presence connected');
			}
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
			this.presenceManager.setFileStartTime();
			this.updatePresence();
		}
	}

	private updatePresence() {
		this.presenceManager.updatePresence(this.currentFile);
	}

	private updateStatusBar() {
		this.statusBarManager.update(
			this.discordClient.isConnected(),
			() => this.toggleConnection()
		);
	}
}