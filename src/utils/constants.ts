import { DiscordRPCSettings } from '../types/settings';

export const DEFAULT_SETTINGS: DiscordRPCSettings = {
	enabled: false,
	showFileName: true,
	showVaultName: true,
	timeMode: 'file',
	useCustomTemplate: false,
	customDetailsTemplate: '%activity_type%: %active_note_name%',
	customStateTemplate: 'Vault: %vault_name%',
	enableCustomButton: false,
	customButtonLabel: 'Visit My Website',
	customButtonUrl: '',
	hideVaultName: false,
	hideNoteName: false,
	hideSpecificPaths: false,
	hiddenPaths: []
};

export const DEFAULT_CLIENT_ID = '763813185022197831';
export const UPDATE_INTERVAL_MS = 15000;