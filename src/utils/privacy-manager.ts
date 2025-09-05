import { DiscordRPCSettings } from '../types/settings';

export class PrivacyManager {
	constructor(private settings: DiscordRPCSettings) {}

	isPathHidden(filePath: string): boolean {
		if (!this.settings.hideSpecificPaths || this.settings.hiddenPaths.length === 0) {
			return false;
		}

		return this.settings.hiddenPaths.some(pattern => {
			pattern = pattern.trim();
			if (!pattern) return false;

			if (pattern === filePath) return true;

			if (pattern.endsWith('/')) {
				return filePath.startsWith(pattern);
			}

			return false;
		});
	}

	shouldHideFile(filePath?: string): boolean {
		return this.settings.hideNoteName || (filePath ? this.isPathHidden(filePath) : false);
	}

	shouldHideVault(): boolean {
		return this.settings.hideVaultName;
	}
}