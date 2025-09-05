export interface DiscordRPCSettings {
	enabled: boolean;
	showFileName: boolean;
	showVaultName: boolean;
	timeMode: 'file' | 'session';
	useCustomTemplate: boolean;
	customDetailsTemplate: string;
	customStateTemplate: string;
	enableCustomButton: boolean;
	customButtonLabel: string;
	customButtonUrl: string;
	hideVaultName: boolean;
	hideNoteName: boolean;
	hideSpecificPaths: boolean;
	hiddenPaths: string[];
}