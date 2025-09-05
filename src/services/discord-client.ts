import { Notice } from 'obsidian';
import * as DiscordRPC from 'discord-rpc';
import * as dotenv from 'dotenv';

import { DiscordRPCClient, DiscordActivity } from '../types/discord';
import { DEFAULT_CLIENT_ID, UPDATE_INTERVAL_MS } from '../utils/constants';

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
			this.rpc = new DiscordRPC.Client({ transport: 'ipc' }) as unknown as DiscordRPCClient;
			
			this.rpc.on('ready', () => {
				this.connected = true;
				
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
			// Silently handle errors
		}
	}

	async setActivity(activity: DiscordActivity): Promise<void> {
		if (!this.connected || !this.rpc) {
			return;
		}

		try {
			await this.rpc.setActivity(activity);
		} catch (error) {
			// Silently handle errors
		}
	}
}