import { Notice } from 'obsidian';
// @ts-ignore
import * as DiscordRPC from 'discord-rpc';
import * as dotenv from 'dotenv';

import { DiscordRPCClient, DiscordActivity } from '../types/discord';
import { DEFAULT_CLIENT_ID, UPDATE_INTERVAL_MS } from '../utils/constants';

// Load environment variables
dotenv.config();

export class DiscordClient {
	private rpc: DiscordRPCClient | null = null;
	private connected = false;
	private clientId: string;
	private updateInterval: NodeJS.Timer | null = null;
	private onReadyCallback?: () => void;
	private onDisconnectedCallback?: () => void;

	constructor() {
		this.clientId = process.env.DISCORD_CLIENT_ID || DEFAULT_CLIENT_ID;
	}

	isConnected(): boolean {
		return this.connected;
	}

	setCallbacks(onReady?: () => void, onDisconnected?: () => void) {
		this.onReadyCallback = onReady;
		this.onDisconnectedCallback = onDisconnected;
	}

	async connect(): Promise<boolean> {
		if (this.connected) return true;

		try {
			this.rpc = new DiscordRPC.Client({ transport: 'ipc' }) as DiscordRPCClient;
			
			this.rpc.on('ready', () => {
				console.log('Discord RPC connected');
				this.connected = true;
				
				// Set up periodic updates
				this.updateInterval = setInterval(() => {
					if (this.onReadyCallback) {
						this.onReadyCallback();
					}
				}, UPDATE_INTERVAL_MS);
				
				if (this.onReadyCallback) {
					this.onReadyCallback();
				}
			});

			this.rpc.on('disconnected', () => {
				console.log('Discord RPC disconnected');
				this.connected = false;
				if (this.updateInterval) {
					clearInterval(this.updateInterval);
					this.updateInterval = null;
				}
				if (this.onDisconnectedCallback) {
					this.onDisconnectedCallback();
				}
			});

			await this.rpc.login({ clientId: this.clientId });
			return true;
		} catch (error) {
			console.error('Failed to connect to Discord:', error);
			new Notice('Failed to connect to Discord. Is Discord running?');
			this.connected = false;
			return false;
		}
	}

	async disconnect(): Promise<void> {
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
		} catch (error) {
			console.error('Error disconnecting Discord RPC:', error);
		}
	}

	async setActivity(activity: DiscordActivity): Promise<void> {
		if (!this.connected || !this.rpc) {
			console.log('Discord RPC: Not connected or RPC client not available');
			return;
		}

		try {
			console.log('Discord RPC: Setting activity:', activity);
			await this.rpc.setActivity(activity);
		} catch (error) {
			console.error('Failed to update Discord presence:', error);
		}
	}
}