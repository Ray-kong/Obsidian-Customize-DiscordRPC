import { Notice } from 'obsidian';

export class StatusBarManager {
	private statusBarItem: HTMLElement;

	constructor(statusBarItem: HTMLElement) {
		this.statusBarItem = statusBarItem;
	}

	update(isConnected: boolean, onToggle: () => Promise<void>) {
		if (!this.statusBarItem) return;

		const status = isConnected ? '🟢' : '🔴';
		this.statusBarItem.setText(status);
		this.statusBarItem.title = isConnected 
			? 'Discord RPC Connected - Click to disconnect' 
			: 'Discord RPC Disconnected - Click to connect';
		
		this.statusBarItem.onclick = async () => {
			await onToggle();
		};
	}
}