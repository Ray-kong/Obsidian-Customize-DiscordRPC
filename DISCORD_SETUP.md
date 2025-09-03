# Discord Rich Presence Setup Guide for Obsidian

## Prerequisites
- Discord desktop app must be running on your computer
- Obsidian must be open

## Quick Fix - Use Pre-configured Application

The plugin is pre-configured with a Discord application ID that should work. If it's not connecting:

1. Make sure Discord desktop app is running (not just the browser version)
2. Check Discord Settings → Activity Privacy → "Display current activity as a status message" is ON
3. Restart both Discord and Obsidian
4. Try the "Reconnect Discord Rich Presence" command in Obsidian

## Creating Your Own Discord Application (Optional)

If you want to customize the application name or images, you can create your own Discord application:

### Step 1: Create Discord Application
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name it "Obsidian" or whatever you prefer
4. Click "Create"

### Step 2: Get Your Client ID
1. In your application's page, go to "OAuth2" in the sidebar
2. Copy the "Client ID"
3. This is what you'll need for the plugin

### Step 3: Update the Plugin
1. Open main.ts in the plugin folder
2. Find the line: `private clientId = '1001910274099888201';`
3. Replace the ID with your Client ID
4. Save and reload Obsidian

### Step 4: Add Rich Presence Assets (Optional)
1. In your Discord application, go to "Rich Presence" → "Art Assets"
2. Upload images for your presence:
   - Upload an image named `obsidian` (this will be the large image)
   - Upload an image named `obsidian_small` (this will be the small image)
3. Save changes

## Troubleshooting

### "Failed to connect to Discord"
- Ensure Discord desktop app is running (not browser)
- Check Windows: Discord might be in system tray
- Check macOS: Discord might be in menu bar
- Try restarting Discord completely

### "Could not connect to Discord"
- This usually means Discord's RPC server isn't running
- Solution: Quit Discord completely and restart it
- On Windows: Right-click Discord in system tray → Quit Discord
- On macOS: Discord menu → Quit Discord

### Discord Activity Settings
1. Open Discord Settings (User Settings)
2. Go to "Activity Privacy" 
3. Enable "Display current activity as a status message"
4. Make sure Obsidian isn't in the blocked list

### Still Not Working?
1. Check the Obsidian Developer Console for errors:
   - Press Ctrl/Cmd + Shift + I
   - Go to Console tab
   - Look for any red error messages
2. Try using a different Discord application ID:
   - Known working IDs:
     - `1001910274099888201` (Default)
     - Create your own following steps above

### Platform-Specific Issues

**Windows:**
- Run Discord as administrator if having permission issues
- Check Windows Firewall isn't blocking Discord RPC

**macOS:**
- Grant Discord accessibility permissions if requested
- Check Security & Privacy settings

**Linux:**
- Make sure Discord was installed properly (not Flatpak/Snap which may have issues with IPC)
- Discord RPC socket should be at `/run/user/1000/discord-ipc-0`

## Testing Your Setup

1. Enable the plugin in Obsidian settings
2. Click "Connect" in the plugin settings
3. Open a note in Obsidian
4. Check your Discord status - it should show:
   - "Editing: [Your note name]"
   - "Vault: [Your vault name]"
   - Time elapsed since you opened the note

## Need More Help?

Check the console logs in Obsidian (Ctrl/Cmd + Shift + I) for specific error messages. The plugin logs detailed connection information that can help diagnose issues.