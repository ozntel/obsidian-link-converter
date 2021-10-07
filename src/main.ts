import { Menu, Plugin, TFile, addIcon } from 'obsidian';
import { LinkConverterSettingsTab, LinkConverterPluginSettings, DEFAULT_SETTINGS } from './settings';
import { ConfirmationModal } from 'modals';
import { convertLinksInActiveFile, convertLinksInVault, convertLinksAndSaveInSingleFile } from 'converter';
import * as Icons from './icons';

export default class LinkConverterPlugin extends Plugin {
    settings: LinkConverterPluginSettings;

    async onload() {
        console.log('Link Converter Loading...');

        addIcon('bracketIcon', Icons.BRACKET_ICON);
        addIcon('markdownIcon', Icons.MARKDOWN_ICON);

        await this.loadSettings();
        this.addSettingTab(new LinkConverterSettingsTab(this.app, this));

        this.addCommand({
            id: 'convert-wikis-to-md-in-active-file',
            name: 'Active File: Convert WikiLinks to Markdown Links',
            callback: () => {
                convertLinksInActiveFile(this.app, 'markdown');
            },
        });

        this.addCommand({
            id: 'convert-md-to-wikis-in-active-file',
            name: 'Active File: Convert Markdown Links to WikiLinks',
            callback: () => {
                convertLinksInActiveFile(this.app, 'wiki');
            },
        });

        this.addCommand({
            id: 'convert-wikis-to-md-in-vault',
            name: 'Vault: Convert WikiLinks to Markdown Links',
            callback: () => {
                let infoText = 'Are you sure you want to convert all Wikilinks to Markdown Links?';
                let modal = new ConfirmationModal(this.app, infoText, () => convertLinksInVault(this.app, 'markdown'));
                modal.open();
            },
        });

        this.addCommand({
            id: 'convert-mdlinks-to-wiki-in-vault',
            name: 'Vault: Convert Markdown Links to WikiLinks',
            callback: () => {
                let infoText = 'Are you sure you want to convert all Markdown Links to Wikilinks?';
                let modal = new ConfirmationModal(this.app, infoText, () => convertLinksInVault(this.app, 'wiki'));
                modal.open();
            },
        });

        if (this.settings.contextMenu) this.app.workspace.on('file-menu', this.addFileMenuItems);
    }

    onunload() {
        console.log('Link Converter Unloading...');
        this.app.workspace.off('file-menu', this.addFileMenuItems);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    addFileMenuItems = (menu: Menu, file: TFile) => {
        if (!(file instanceof TFile && file.extension === 'md')) return;

        menu.addSeparator();

        menu.addItem((item) => {
            item.setTitle('Links to Wiki')
                .setIcon('bracketIcon')
                .onClick(() => convertLinksAndSaveInSingleFile(file, this.app, 'wiki'));
        });

        menu.addItem((item) => {
            item.setTitle('Links to Markdown')
                .setIcon('markdownIcon')
                .onClick(() => convertLinksAndSaveInSingleFile(file, this.app, 'markdown'));
        });
    };
}
