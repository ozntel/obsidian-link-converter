import { App, PluginSettingTab, Setting } from 'obsidian';
import LinkConverterPlugin from './main';

export interface LinkConverterPluginSettings {
    mySetting: string;
}

export const DEFAULT_SETTINGS: LinkConverterPluginSettings = {
    mySetting: 'default',
};

export class LinkConverterSettingsTab extends PluginSettingTab {
    plugin: LinkConverterPlugin;

    constructor(app: App, plugin: LinkConverterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Settings for my awesome plugin.' });

        new Setting(containerEl)
            .setName('Setting #1')
            .setDesc("It's a secret")
            .addText((text) =>
                text
                    .setPlaceholder('Enter your secret')
                    .setValue('')
                    .onChange(async (value) => {
                        console.log('Secret: ' + value);
                        this.plugin.settings.mySetting = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}
