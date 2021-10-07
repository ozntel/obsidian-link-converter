import { App, PluginSettingTab, Setting, Menu, TFile } from 'obsidian';
import LinkConverterPlugin from './main';

type finalLinkFormat = 'not-change' | 'relative-path' | 'absolute-path';

export interface LinkConverterPluginSettings {
    mySetting: string;
    contextMenu: boolean;
    finalLinkFormat: finalLinkFormat;
}

export const DEFAULT_SETTINGS: LinkConverterPluginSettings = {
    mySetting: 'default',
    contextMenu: true,
    finalLinkFormat: 'not-change',
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

        new Setting(containerEl)
            .setName('Converted Link Format')
            .setDesc(
                'Select the preferred option for the final link format after the conversion. Plugin will use the preferrence where possible'
            )
            .addDropdown((dropdown) => {
                dropdown
                    .addOption('not-change', 'Do not change')
                    .addOption('relative-path', 'Relative Path')
                    .addOption('absolute-path', 'Absolute Path')
                    .setValue(this.plugin.settings.finalLinkFormat)
                    .onChange((option: finalLinkFormat) => {
                        this.plugin.settings.finalLinkFormat = option;
                        this.plugin.saveSettings();
                    });
            });

        const coffeeDiv = containerEl.createDiv('coffee');
        coffeeDiv.addClass('oz-coffee-div');
        const coffeeLink = coffeeDiv.createEl('a', { href: 'https://ko-fi.com/L3L356V6Q' });
        const coffeeImg = coffeeLink.createEl('img', {
            attr: {
                src: 'https://cdn.ko-fi.com/cdn/kofi2.png?v=3',
            },
        });
        coffeeImg.height = 45;
    }
}
