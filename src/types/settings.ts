export interface DiscordRPCSettings {
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