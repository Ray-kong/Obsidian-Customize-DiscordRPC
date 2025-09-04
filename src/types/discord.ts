export interface DiscordRPCClient {
	on(event: string, callback: () => void): void;
	login(options: { clientId: string }): Promise<void>;
	setActivity(activity: DiscordActivity): Promise<void>;
	clearActivity(): Promise<void>;
	destroy(): Promise<void>;
}

export interface DiscordActivity {
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