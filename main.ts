import { Plugin } from 'obsidian';

interface DiscordRPCSettings {
	enabled: boolean;
	showFileName: boolean;
	showVaultName: boolean;
}

const DEFAULT_SETTINGS: DiscordRPCSettings = {
	enabled: true,
	showFileName: true,
	showVaultName: true
}

export default class ObsidianDiscordRPC extends Plugin {
	settings: DiscordRPCSettings;

	async onload() {
		await this.loadSettings();
		
		// Initialize Discord RPC functionality
		this.initializeDiscordRPC();
	}

	onunload() {
		// Clean up Discord RPC connection
		this.cleanupDiscordRPC();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private initializeDiscordRPC() {
		// TODO: Implement Discord RPC initialization
		console.log('Discord RPC initialized');
	}

	private cleanupDiscordRPC() {
		// TODO: Implement Discord RPC cleanup
		console.log('Discord RPC cleaned up');
	}
}