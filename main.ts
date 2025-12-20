import { Plugin, Notice, TFile } from 'obsidian';

import { DiscordRPCSettings } from './src/types/settings';
import { DEFAULT_SETTINGS } from './src/utils/constants';
import { DiscordClient } from './src/services/discord-client';
import { PresenceManager } from './src/services/presence-manager';
import { StatusBarManager } from './src/ui/status-bar';
import { DiscordRPCSettingTab, SettingsTabCallbacks } from './src/ui/settings-tab';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default class ObsidianDiscordRPC extends Plugin {
	settings: DiscordRPCSettings;
	private discordClient: DiscordClient;
	private presenceManager: PresenceManager;
	private statusBarManager: StatusBarManager;
	private currentFile: TFile | null = null;

	async onload() {
		await this.loadSettings();
		
		this.discordClient = new DiscordClient();
		this.presenceManager = new PresenceManager(
			this.settings,
			this.app.vault,
			this.app.workspace,
			this.discordClient
		);

		const statusBarItem = this.addStatusBarItem();
		this.statusBarManager = new StatusBarManager(statusBarItem);
		this.updateStatusBar();

		this.discordClient.setCallbacks(
			() => this.onDiscordReady().catch(console.error),
			() => this.onDiscordDisconnected()
		);

		if (this.settings.enabled) {
			await this.connectDiscord();
		}

		this.registerEventListeners();
		this.registerCommands();
		this.addSettingTab(this.createSettingTab());
	}

	onunload() {
		this.discordClient.disconnect().catch(console.error);
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

		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				setTimeout(() => {
					this.updatePresence();
				}, 100);
			})
		);
	}

	private registerCommands() {
		this.addCommand({
			id: 'toggle-discord-rpc',
			name: 'Toggle Discord rich presence',
			callback: () => this.toggleConnection().catch(console.error)
		});

		this.addCommand({
			id: 'reconnect-discord-rpc',
			name: 'Reconnect Discord rich presence',
			callback: () => this.handleReconnectCommand().catch(console.error)
		});
	}

	private async handleReconnectCommand(): Promise<void> {
		await this.disconnectDiscord();
		await this.connectDiscord();
		if (this.discordClient.isConnected()) {
			new Notice('Discord rich presence reconnected');
		}
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
		const data = (await this.loadData()) as unknown;
		const persisted = isRecord(data) ? (data as Partial<DiscordRPCSettings>) : {};

		this.settings = {
			...DEFAULT_SETTINGS,
			...persisted,
		};
		
		await this.migrateOldSettings(data);
	}

	private async migrateOldSettings(data: unknown) {
		if (!isRecord(data)) return;

		let needsMigration = false;
		const deprecatedKeys = [
			'showTimeElapsed',
			'useCustomDetails',
			'customDetailsPrefix',
			'customStatePrefix',
			'customDetails',
			'customState'
		];

		deprecatedKeys.forEach((key) => {
			if (key in data) {
				delete data[key];
				delete (this.settings as unknown as Record<string, unknown>)[key];
				needsMigration = true;
			}
		});

		if (needsMigration) {
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async updateSettings(settings: DiscordRPCSettings) {
		this.settings = settings;
		this.presenceManager.updateSettings(settings);
		await this.saveSettings();
		
		if (this.settings.enabled && !this.discordClient.isConnected()) {
			await this.connectDiscord();
		} else if (!this.settings.enabled && this.discordClient.isConnected()) {
			await this.disconnectDiscord();
		} else if (this.discordClient.isConnected()) {
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
			new Notice('Discord rich presence disconnected');
		} else {
			await this.connectDiscord();
			if (this.discordClient.isConnected()) {
				new Notice('Discord rich presence connected');
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

	private updatePresence(): void {
		this.presenceManager.updatePresence(this.currentFile).catch(console.error);
	}

	private updateStatusBar() {
		this.statusBarManager.update(
			this.discordClient.isConnected(),
			() => this.toggleConnection()
		);
	}
}
