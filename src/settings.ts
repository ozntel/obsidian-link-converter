import { App, PluginSettingTab, Setting, Menu, TFile } from 'obsidian';
import LinkConverterPlugin from './main';

export interface LinkConverterPluginSettings {
    mySetting: string;
    contextMenu: boolean;
}

export const DEFAULT_SETTINGS: LinkConverterPluginSettings = {
    mySetting: 'default',
    contextMenu: true,
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

        containerEl.createEl('h2', { text: 'Obsidian Link Converter' });

        new Setting(containerEl)
            .setName('File Context Menu')
            .setDesc(
                "Turn this option off if you don't want single file commands to appear within the file context menu"
            )
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.contextMenu).onChange((newVal) => {
                    this.plugin.settings.contextMenu = newVal;
                    this.plugin.saveSettings();
                    if (newVal) {
                        this.plugin.app.workspace.on('file-menu', this.plugin.addFileMenuItems);
                    } else {
                        this.plugin.app.workspace.off('file-menu', this.plugin.addFileMenuItems);
                    }
                });
            });
    }
}
