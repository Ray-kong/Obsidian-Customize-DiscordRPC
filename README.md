# Obsidian Customize DiscordRPC

A fully customizable Discord Rich Presence plugin for Obsidian that shows your activity, vault name, note name, and time spent working on your notes.

![Discord Rich Presence Example](https://via.placeholder.com/400x100/5865F2/ffffff?text=Discord+Rich+Presence)

## ✨ Features

- **🎯 Rich Presence Display**: Show your current note and vault activity in Discord
- **⏱️ Time Tracking**: Display time spent on current file or entire session
- **🎨 Custom Templates**: Create fully customizable presence text with placeholders
- **🔒 Privacy Controls**: Hide vault names, note names, or specific files/folders
- **🌐 Custom Button**: Add your website/homepage button to your Discord profile
- **📖 Reading Mode Detection**: Automatically detects reading vs editing mode
- **📊 Status Bar Integration**: Visual connection indicator with click-to-toggle
- **🎛️ Easy Controls**: Toggle connection via status bar or command palette

## 🚀 Quick Setup

1. **Install the plugin** in your Obsidian vault
2. **Enable it** in Settings → Community plugins
3. **Make sure Discord is running** on your computer
4. **Click Connect** in the plugin settings or use the status bar indicator

That's it! The plugin comes pre-configured and ready to use.

## ⚙️ Settings

### Display Options
- **Show file name**: Display the name of the currently open file
- **Show vault name**: Display the name of your current vault  
- **Time tracking mode**: Choose between current file time or entire session time

### Privacy Settings
- **Hide vault name**: Hide your actual vault name from Discord
- **Hide note name**: Hide specific note names and show generic text
- **Hide specific files/folders**: Hide notes matching certain paths
  - Supports exact file paths: `Personal/Diary.md`, `MyNotes.md`
  - Supports folder patterns: `Private/`, `Confidential/`

### Custom Templates
Create fully customizable presence text using placeholders:

**Available Placeholders:**
- `%activity_type%` - "Reading" or "Editing" based on current mode
- `%active_note_name%` - Current note name
- `%active_note_path%` - Full path to current note
- `%vault_name%` - Vault name
- `%folder_name%` - Current note's folder
- `%file_extension%` - File extension (md, txt, etc.)
- `%workspace_name%` - Same as vault name

**Example Template:**
```
📝 %activity_type% %active_note_name% in %vault_name%
```

### Custom Button
Add a custom button to your Discord profile that others can click:
- **Button label**: Text shown on the button (max 32 characters)
- **Button URL**: Your website, portfolio, or any URL you want to share

## 🎮 Usage

### Connection Methods
- **Status Bar**: Click the 🟢/🔴 indicator to connect/disconnect
- **Command Palette**: Use "Toggle Discord Rich Presence"
- **Settings**: Use the Connect/Disconnect button in plugin settings

### What Others See
When enabled, your Discord status will show:
- Your current activity (Reading/Editing)
- Note name (if not hidden)
- Vault name (if not hidden)  
- Time elapsed since you started
- Custom button (if configured)

## 🛠️ Advanced Setup (Optional)

If you want to use your own Discord application with custom images:

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Upload custom images in Rich Presence → Art Assets:
   - Upload any image as the **large image** (will be the main cover image)
   - Upload any image as the **small image** (will be the small icon)
   - Note: The image names don't matter, just upload them as cover images
4. Copy your Application ID
5. Create a `.env` file in the plugin folder and add:
   ```
   DISCORD_CLIENT_ID=your_application_id_here
   ```
6. Rebuild the plugin with `npm run build`

## 📋 Requirements

- Obsidian v0.15.0 or higher
- Discord desktop app (browser version won't work)
- Discord must be running for Rich Presence to connect

## 🐛 Troubleshooting

**"Failed to connect to Discord"**
- Ensure Discord desktop app is running (not just browser)
- Try restarting Discord completely
- Check Discord Settings → Activity Privacy → Enable "Display current activity as a status message"

**"No activity showing in Discord"**  
- Verify Discord privacy settings allow activity display
- Make sure Obsidian isn't blocked in Discord's activity settings
- Try toggling the connection off and on again


## 🤝 Contributing

Found a bug or have a feature request? We'd love your help!

Bug reports, feature enhancements, and PRs are welcome!

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.
