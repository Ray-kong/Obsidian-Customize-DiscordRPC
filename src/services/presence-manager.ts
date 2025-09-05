import { TFile, Vault, Workspace } from 'obsidian';

import { DiscordActivity } from '../types/discord';
import { DiscordRPCSettings } from '../types/settings';
import { TemplateProcessor, TemplateContext } from '../utils/template-processor';
import { PrivacyManager } from '../utils/privacy-manager';
import { DiscordClient } from './discord-client';

export class PresenceManager {
	private templateProcessor: TemplateProcessor;
	private privacyManager: PrivacyManager;
	private startTime: number = Date.now();
	private sessionStartTime: number = Date.now();

	constructor(
		private settings: DiscordRPCSettings,
		private vault: Vault,
		private workspace: Workspace,
		private discordClient: DiscordClient
	) {
		this.templateProcessor = new TemplateProcessor();
		this.privacyManager = new PrivacyManager(settings);
	}

	updateSettings(settings: DiscordRPCSettings) {
		this.settings = settings;
		this.privacyManager = new PrivacyManager(settings);
	}

	setFileStartTime(time: number = Date.now()) {
		this.startTime = time;
	}

	private isInReadingMode(): boolean {
		try {
			const activeLeaf = this.workspace.activeLeaf;
			if (!activeLeaf) return false;
			
			const view = activeLeaf.view;
			if (!view) return false;
			
			if (view.getViewType() === 'markdown') {
				const markdownView = view as { currentMode?: { type: string } };
				return markdownView.currentMode?.type === 'preview';
			}
			
			return false;
		} catch (error) {
			return false;
		}
	}

	private createActivity(currentFile: TFile | null): DiscordActivity {
		const activity: DiscordActivity = {
			largeImageKey: 'obsidian',
			largeImageText: 'Obsidian - A knowledge base',
			smallImageKey: 'obsidian_small',
			smallImageText: 'Taking notes',
			instance: false
		};

		const isReading = this.isInReadingMode();
		const shouldHideFile = currentFile && this.privacyManager.shouldHideFile(currentFile.path);
		const shouldHideVault = this.privacyManager.shouldHideVault();

		if (!shouldHideFile) {
			if (this.settings.useCustomTemplate && this.settings.customDetailsTemplate.trim()) {
				const context: TemplateContext = {
					currentFile,
					vault: this.vault,
					isReading
				};
				activity.details = this.templateProcessor.processTemplate(this.settings.customDetailsTemplate, context);
			} else if (!this.settings.useCustomTemplate && this.settings.showFileName) {
				const activityType = isReading ? 'Reading' : 'Editing';
				
				if (currentFile) {
					activity.details = `${activityType}: ${currentFile.basename}`;
				} else {
					activity.details = `${activityType} a note`;
				}
			}
		}

		if (this.settings.showVaultName && !shouldHideVault) {
			if (this.settings.useCustomTemplate && this.settings.customStateTemplate.trim()) {
				const context: TemplateContext = {
					currentFile,
					vault: this.vault,
					isReading
				};
				activity.state = this.templateProcessor.processTemplate(this.settings.customStateTemplate, context);
			} else if (!this.settings.useCustomTemplate) {
				const vaultName = this.vault.getName();
				activity.state = `Vault: ${vaultName}`;
			}
		}

		const timeToUse = this.settings.timeMode === 'session' ? this.sessionStartTime : this.startTime;
		activity.startTimestamp = Math.floor(timeToUse / 1000);

		const buttons: Array<{ label: string; url: string }> = [];
		
		if (this.settings.enableCustomButton && this.settings.customButtonUrl) {
			buttons.push({
				label: this.settings.customButtonLabel || 'Visit My Website',
				url: this.settings.customButtonUrl
			});
		}
		
		if (buttons.length > 0) {
			activity.buttons = buttons;
		}

		return activity;
	}

	async updatePresence(currentFile: TFile | null): Promise<void> {
		if (!this.discordClient.isConnected()) {
			return;
		}

		const activity = this.createActivity(currentFile);
		await this.discordClient.setActivity(activity);
	}
}