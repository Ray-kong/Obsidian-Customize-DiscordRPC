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
			? 'Discord RPC connected - click to disconnect' 
			: 'Discord RPC disconnected - click to connect';

		this.statusBarItem.onclick = () => {
			onToggle().catch(console.error);
		};
	}
}
