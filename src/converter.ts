import LinkConverterPlugin from 'main';
import { App, TFile, normalizePath } from 'obsidian';

// --> Converts single file to provided final format and save back in the file
export const convertLinksAndSaveInSingleFile = async (mdFile: TFile, plugin: LinkConverterPlugin, finalFormat: 'markdown' | 'wiki') => {
    let normalizedPath = normalizePath(mdFile.path);
    let fileText = await plugin.app.vault.adapter.read(normalizedPath);
    let newFileText =
        finalFormat === 'markdown'
            ? convertWikiLinksToMarkdown(fileText, mdFile, plugin)
            : convertMarkdownLinksToWikiLinks(fileText, mdFile, plugin);
    await plugin.app.vault.adapter.write(normalizedPath, newFileText);
};

// --> Command Function: Converts All Links and Saves in Current Active File
export const convertLinksInActiveFile = async (plugin: LinkConverterPlugin, finalFormat: 'markdown' | 'wiki') => {
    let mdFile: TFile = plugin.app.workspace.getActiveFile();
    await convertLinksAndSaveInSingleFile(mdFile, plugin, finalFormat);
};

// --> Command Function: Converts All Links in All Files in Vault and Save in Corresponding Files
export const convertLinksInVault = async (plugin: LinkConverterPlugin, finalFormat: 'markdown' | 'wiki') => {
    let mdFiles: TFile[] = plugin.app.vault.getMarkdownFiles();
    for (let mdFile of mdFiles) {
        // --> Skip Excalidraw and Kanban Files
        if (hasFrontmatter(plugin.app, mdFile.path, 'excalidraw-plugin') || hasFrontmatter(plugin.app, mdFile.path, 'kanban-plugin')) {
            continue;
        }
        await convertLinksAndSaveInSingleFile(mdFile, plugin, finalFormat);
    }
};

const hasFrontmatter = (app: App, filePath: string, keyToCheck: string) => {
    let metaCache = app.metadataCache.getCache(filePath);
    return metaCache.frontmatter && metaCache.frontmatter[keyToCheck];
};

// --> Converts links within given string from Wiki to MD
export const convertWikiLinksToMarkdown = (md: string, sourceFile: TFile, plugin: LinkConverterPlugin): string => {
    let newMdText = md;
    let wikiRegex = /\[\[.*?\]\]/g;
    let matches = newMdText.match(wikiRegex);
    if (matches) {
        let fileRegex = /(?<=\[\[).*?(?=(\]|\|))/;
        let altRegex = /(?<=\|).*(?=]])/;
        for (let wiki of matches) {
            let fileMatch = wiki.match(fileRegex);
            if (fileMatch) {
                let altMatch = wiki.match(altRegex);
                let mdLink = createMarkdownLink(fileMatch[0], altMatch ? altMatch[0] : '', sourceFile, plugin);
                newMdText = newMdText.replace(wiki, mdLink);
            }
        }
    }
    return newMdText;
};

const createMarkdownLink = (link: string, alt: string, sourceFile: TFile, plugin: LinkConverterPlugin) => {
    return `[${alt}](${encodeURI(link)})`;
};

// --> Converts links within given string from MD to Wiki
const convertMarkdownLinksToWikiLinks = (md: string, sourceFile: TFile, plugin: LinkConverterPlugin): string => {
    let newMdText = md;
    let mdLinkRegex = /\[(^$|.*?)\]\((.*?)\)/g;
    let matches = newMdText.match(mdLinkRegex);
    if (matches) {
        let fileRegex = /(?<=\().*(?=\))/;
        let altRegex = /(?<=\[)(^$|.*?)(?=\])/;
        for (let mdLink of matches) {
            let fileMatch = mdLink.match(fileRegex);
            if (fileMatch) {
                // Web links should stay with Markdown Format
                if (fileMatch[0].startsWith('http')) continue;
                let altMatch = mdLink.match(altRegex);
                let wikiLink = createWikiLink(fileMatch[0], altMatch ? altMatch[0] : undefined, sourceFile, plugin);
                newMdText = newMdText.replace(mdLink, wikiLink);
            }
        }
    }
    return newMdText;
};

const createWikiLink = (link: string, alt: string, sourceFile: TFile, plugin: LinkConverterPlugin) => {
    return `[[${decodeURI(link)}${alt && alt !== '' ? '|' + alt : ''}]]`;
};

/**
 *
 * @param sourceFilePath Path of the file, in which the links are going to be used
 * @param linkedFilePath File path, which will be referred in the source file
 * @returns
 */
function createRelativeLink(sourceFilePath: string, linkedFilePath: string) {
    function trim(arr: string[]) {
        let start = 0;
        for (; start < arr.length; start++) {
            if (arr[start] !== '') break;
        }

        var end = arr.length - 1;
        for (; end >= 0; end--) {
            if (arr[end] !== '') break;
        }

        if (start > end) return [];
        return arr.slice(start, end - start + 1);
    }

    var fromParts = trim(sourceFilePath.split('/'));
    var toParts = trim(linkedFilePath.split('/'));

    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
        if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
        }
    }

    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length - 1; i++) {
        outputParts.push('..');
    }

    outputParts = outputParts.concat(toParts.slice(samePartsLength));

    return outputParts.join('/');
}
