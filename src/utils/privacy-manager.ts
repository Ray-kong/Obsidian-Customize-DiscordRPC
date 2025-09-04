import { DiscordRPCSettings } from '../types/settings';

export class PrivacyManager {
	constructor(private settings: DiscordRPCSettings) {}

	isPathHidden(filePath: string): boolean {
		if (!this.settings.hideSpecificPaths || this.settings.hiddenPaths.length === 0) {
			return false;
		}

		return this.settings.hiddenPaths.some(pattern => {
			// Remove leading/trailing whitespace
			pattern = pattern.trim();
			if (!pattern) return false;

			// Handle exact path match
			if (pattern === filePath) return true;

			// Handle folder patterns (ending with /)
			if (pattern.endsWith('/')) {
				return filePath.startsWith(pattern);
			}

			// No other patterns supported
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