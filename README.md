# Customize DiscordRPC

A customizable Discord Rich Presence plugin for Obsidian that shows your vault name, note name, and time spent working on notes.

## Features

- **Rich Presence Display**: Shows your current note and vault in Discord
- **Customizable Settings**: Toggle file names, vault names, and elapsed time
- **Custom Prefixes**: Replace default "Editing" and "Vault" text with your own
- **Status Bar Integration**: Visual indicator of connection status
- **Secure Configuration**: Uses environment variables to keep your Discord application ID private

## Setup

### 1. Discord Application Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or use an existing one
3. Copy your Application ID from the General Information page
4. In the Rich Presence section, upload your custom images (optional)

### 2. Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Discord Application ID:
   ```
   DISCORD_CLIENT_ID=your_discord_client_id_here
   ```

3. The `.env` file is automatically ignored by git to keep your secrets safe.

### 3. Installation

1. Clone this repository to your Obsidian plugins folder:
   ```bash
   git clone <repository-url> .obsidian/plugins/Obsidian-Customize-DiscordRPC
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. Enable the plugin in Obsidian settings

## Usage

Once enabled, the plugin will automatically connect to Discord when you start Obsidian (if Discord is running). You can:

- Toggle the connection using the status bar indicator (🟢/🔴)
- Use the command palette to "Toggle Discord Rich Presence" or "Reconnect Discord Rich Presence"
- Customize display options in the plugin settings

## Configuration Options

- **Show file name**: Display the currently open file name
- **Show vault name**: Display your vault name
- **Show time elapsed**: Show how long you've been working on the current note
- **Custom prefixes**: Replace default text with your own custom prefixes

## First time developing plugins?

Quick starting guide for new plugin devs:

- Check if [someone already developed a plugin for what you want](https://obsidian.md/plugins)! There might be an existing plugin similar enough that you can partner up with.
- Make a copy of this repo as a template with the "Use this template" button (login to GitHub if you don't see it).
- Clone your repo to a local development folder. For convenience, you can place this folder in your `.obsidian/plugins/your-plugin-name` folder.
- Install NodeJS, then run `npm i` in the command line under your repo folder.
- Run `npm run dev` to compile your plugin from `main.ts` to `main.js`.
- Make changes to `main.ts` (or create new `.ts` files). Those changes should be automatically compiled into `main.js`.
- Reload Obsidian to load the new version of your plugin.
- Enable plugin in settings window.
- For updates to the Obsidian API run `npm update` in the command line under your repo folder.

## Releasing new releases

- Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
- Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.
- Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`. See here for an example: https://github.com/obsidianmd/obsidian-sample-plugin/releases
- Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments. Note: The manifest.json file must be in two places, first the root path of your repository and also in the release.
- Publish the release.

> You can simplify the version bump process by running `npm version patch`, `npm version minor` or `npm version major` after updating `minAppVersion` manually in `manifest.json`.
> The command will bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`

## Adding your plugin to the community plugin list

- Check the [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).
- Publish an initial version.
- Make sure you have a `README.md` file in the root of your repo.
- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.

## How to use

- Clone this repo.
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## Improve code quality with eslint (optional)
- [ESLint](https://eslint.org/) is a tool that analyzes your code to quickly find problems. You can run ESLint against your plugin to find common bugs and ways to improve your code. 
- To use eslint with this project, make sure to install eslint from terminal:
  - `npm install -g eslint`
- To use eslint to analyze this project use this command:
  - `eslint main.ts`
  - eslint will then create a report with suggestions for code improvement by file and line number.
- If your source code is in a folder, such as `src`, you can use eslint with this command to analyze all files in that folder:
  - `eslint .\src\`

## Funding URL

You can include funding URLs where people who use your plugin can financially support it.

The simple way is to set the `fundingUrl` field to your link in your `manifest.json` file:

```json
{
    "fundingUrl": "https://buymeacoffee.com"
}
```

If you have multiple URLs, you can also do:

```json
{
    "fundingUrl": {
        "Buy Me a Coffee": "https://buymeacoffee.com",
        "GitHub Sponsor": "https://github.com/sponsors",
        "Patreon": "https://www.patreon.com/"
    }
}
```

## API Documentation

See https://github.com/obsidianmd/obsidian-api
