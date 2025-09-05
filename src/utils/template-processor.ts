import { TFile, Vault } from 'obsidian';

export interface TemplateContext {
	currentFile: TFile | null;
	vault: Vault;
	isReading: boolean;
}

export class TemplateProcessor {
	processTemplate(template: string, context: TemplateContext): string {
		if (!template) return '';

		let result = template;

		const placeholders = {
			'%active_note_name%': context.currentFile ? context.currentFile.basename : 'Unknown',
			'%active_note_path%': context.currentFile ? context.currentFile.path : '',
			'%vault_name%': context.vault.getName(),
			'%folder_name%': context.currentFile ? context.currentFile.parent?.name || 'Root' : 'Unknown',
			'%file_extension%': context.currentFile ? context.currentFile.extension : '',
			'%workspace_name%': context.vault.getName(),
			'%activity_type%': context.isReading ? 'Reading' : 'Editing',
		};

		Object.entries(placeholders).forEach(([placeholder, value]) => {
			result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
		});

		return result;
	}
}