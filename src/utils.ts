import LinkConverterPlugin from 'main';
import { TFile, TFolder, App } from 'obsidian';

// Helper Function To Get List of Files
export const getFilesUnderPath = (path: string, plugin: LinkConverterPlugin): TFile[] => {
    var filesUnderPath: TFile[] = [];
    recursiveFx(path, plugin.app);
    function recursiveFx(path: string, app: App) {
        var folderObj = app.vault.getAbstractFileByPath(path);
        if (folderObj instanceof TFolder && folderObj.children) {
            for (let child of folderObj.children) {
                if (child instanceof TFile) filesUnderPath.push(child);
                if (child instanceof TFolder) recursiveFx(child.path, app);
            }
        }
    }
    return filesUnderPath;
};
