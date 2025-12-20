declare module "discord-rpc" {
	export type Transport = "ipc" | "websocket";

	export interface ClientOptions {
		transport: Transport;
	}

	export interface LoginOptions {
		clientId: string;
	}

	export class Client {
		constructor(options: ClientOptions);
		on(event: string, callback: () => void): void;
		login(options: LoginOptions): Promise<void>;
		setActivity(activity: unknown): Promise<void>;
		clearActivity(): Promise<void>;
		destroy(): Promise<void>;
	}
}


