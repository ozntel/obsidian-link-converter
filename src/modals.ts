import LinkConverterPlugin from 'main';
import { App, FuzzySuggestModal, Modal, TFolder } from 'obsidian';
import * as Converter from './converter';

export class ConfirmationModal extends Modal {
    callback: Function;
    message: string;

    constructor(app: App, message: string, callback: Function) {
        super(app);
        this.message = message;
        this.callback = callback;
    }

    onOpen() {
        let { contentEl } = this;

        let mainDiv = contentEl.createEl('div');
        mainDiv.addClass('oz-modal-center');
        mainDiv.innerHTML = `
            <div class="oz-modal-title">
                <h2>Link Converter Plugin</h2>
            </div>
            <p>${this.message}</p>
        `;

        let continueButton = contentEl.createEl('button', { text: 'Continue' });
        continueButton.addEventListener('click', () => {
            this.callback();
            this.close();
        });

        const cancelButton = contentEl.createEl('button', { text: 'Cancel' });
        cancelButton.style.cssText = 'float: right;';
        cancelButton.addEventListener('click', () => this.close());
    }
}

type FinalFormat = 'markdown' | 'wiki';

export class FolderSuggestionModal extends FuzzySuggestModal<TFolder> {
    app: App;
    plugin: LinkConverterPlugin;
    finalFormat: FinalFormat;

    constructor(plugin: LinkConverterPlugin, finalFormat: FinalFormat) {
        super(plugin.app);
        this.plugin = plugin;
        this.finalFormat = finalFormat;
    }

    getItemText(item: TFolder): string {
        return item.path;
    }

    getItems(): TFolder[] {
        return getAllFoldersInVault(this.app);
    }

    onChooseItem(folder: TFolder, evt: MouseEvent | KeyboardEvent) {
        let infoText = `Are you sure you want to convert all 
            ${this.finalFormat === 'wiki' ? 'Markdown Links to Wikilinks' : 'Wikilinks to Markdown Links'} 
            under ${folder.name}?`;
        let modal = new ConfirmationModal(this.app, infoText, () => Converter.convertLinksUnderFolder(folder, this.plugin, this.finalFormat));
        modal.open();
    }
}

function getAllFoldersInVault(app: App): TFolder[] {
    let folders: TFolder[] = [];
    let rootFolder = app.vault.getRoot();
    folders.push(rootFolder);
    function recursiveFx(folder: TFolder) {
        for (let child of folder.children) {
            if (child instanceof TFolder) {
                let childFolder: TFolder = child as TFolder;
                folders.push(childFolder);
                if (childFolder.children) recursiveFx(childFolder);
            }
        }
    }
    recursiveFx(rootFolder);
    return folders;
}
