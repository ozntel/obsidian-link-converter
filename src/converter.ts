import LinkConverterPlugin from 'main';
import { App, TFile, normalizePath } from 'obsidian';

/* -------------------- LINK DETECTOR -------------------- */

interface LinkMatch {
    type: 'markdown' | 'wiki';
    match: string;
    linkText: string;
    altText: string;
    sourceFilePath: string;
}

const getAllLinkMatchesInFile = async (mdFile: TFile, plugin: LinkConverterPlugin): Promise<LinkMatch[]> => {
    const linkMatches: LinkMatch[] = [];
    let normalizedPath = normalizePath(mdFile.path);
    let fileText = await plugin.app.vault.adapter.read(normalizedPath);

    // --> Get All WikiLinks
    let wikiRegex = /\[\[.*?\]\]/g;
    let wikiMatches = fileText.match(wikiRegex);

    if (wikiMatches) {
        let fileRegex = /(?<=\[\[).*?(?=(\]|\|))/;
        let altRegex = /(?<=\|).*(?=]])/;

        for (let wikiMatch of wikiMatches) {
            let fileMatch = wikiMatch.match(fileRegex);
            if (fileMatch) {
                // Web links are to be skipped
                if (fileMatch[0].startsWith('http')) continue;
                let altMatch = wikiMatch.match(altRegex);
                let linkMatch: LinkMatch = {
                    type: 'wiki',
                    match: wikiMatch,
                    linkText: fileMatch[0],
                    altText: altMatch ? altMatch[0] : '',
                    sourceFilePath: mdFile.path,
                };
                linkMatches.push(linkMatch);
            }
        }
    }

    // --> Get All Markdown Links
    let markdownRegex = /\[(^$|.*?)\]\((.*?)\)/g;
    let markdownMatches = fileText.match(markdownRegex);

    if (markdownMatches) {
        let fileRegex = /(?<=\().*(?=\))/;
        let altRegex = /(?<=\[)(^$|.*?)(?=\])/;
        for (let markdownMatch of markdownMatches) {
            let fileMatch = markdownMatch.match(fileRegex);
            if (fileMatch) {
                // Web links are to be skipped
                if (fileMatch[0].startsWith('http')) continue;
                let altMatch = markdownMatch.match(altRegex);
                let linkMatch: LinkMatch = {
                    type: 'markdown',
                    match: markdownMatch,
                    linkText: fileMatch[0],
                    altText: altMatch ? altMatch[0] : '',
                    sourceFilePath: mdFile.path,
                };
                linkMatches.push(linkMatch);
            }
        }
    }

    return linkMatches;
};

/* -------------------- CONVERTERS -------------------- */

// --> Converts single file to provided final format and save back in the file
export const convertLinksAndSaveInSingleFile = async (mdFile: TFile, plugin: LinkConverterPlugin, finalFormat: 'markdown' | 'wiki') => {
    let normalizedPath = normalizePath(mdFile.path);
    let fileText = await plugin.app.vault.adapter.read(normalizedPath);
    let newFileText =
        finalFormat === 'markdown'
            ? await convertWikiLinksToMarkdown(fileText, mdFile, plugin)
            : await convertMarkdownLinksToWikiLinks(fileText, mdFile, plugin);
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

/* -------------------- LINKS TO MARKDOWN CONVERTER -------------------- */

// --> Converts links within given string from Wiki to MD
export const convertWikiLinksToMarkdown = async (md: string, sourceFile: TFile, plugin: LinkConverterPlugin): Promise<string> => {
    let newMdText = md;
    let linkMatches: LinkMatch[] = await getAllLinkMatchesInFile(sourceFile, plugin);
    let wikiMatches = linkMatches.filter((match) => match.type === 'wiki');
    for (let wikiMatch of wikiMatches) {
        let mdLink = createLink('markdown', wikiMatch.linkText, wikiMatch.altText, sourceFile, plugin);
        newMdText = newMdText.replace(wikiMatch.match, mdLink);
    }
    return newMdText;
};

/* -------------------- LINKS TO WIKI CONVERTER -------------------- */

// --> Converts links within given string from MD to Wiki
const convertMarkdownLinksToWikiLinks = async (md: string, sourceFile: TFile, plugin: LinkConverterPlugin): Promise<string> => {
    let newMdText = md;
    let linkMatches: LinkMatch[] = await getAllLinkMatchesInFile(sourceFile, plugin);
    let markdownMatches = linkMatches.filter((match) => match.type === 'markdown');
    for (let markdownMatch of markdownMatches) {
        let mdLink = createLink('wiki', markdownMatch.linkText, markdownMatch.altText, sourceFile, plugin);
        newMdText = newMdText.replace(markdownMatch.match, mdLink);
    }
    return newMdText;
};

/* -------------------- HELPERS -------------------- */

const createLink = (dest: 'markdown' | 'wiki', originalLink: string, alt: string, sourceFile: TFile, plugin: LinkConverterPlugin) => {
    let finalLink = originalLink;

    if (plugin.settings.finalLinkFormat !== 'not-change') {
        let fileLink = decodeURI(finalLink);
        let file = plugin.app.metadataCache.getFirstLinkpathDest(fileLink, sourceFile.path);
        if (file) {
            if (plugin.settings.finalLinkFormat === 'absolute-path') {
                finalLink = file.path;
            } else if (plugin.settings.finalLinkFormat === 'relative-path') {
                finalLink = getRelativeLink(sourceFile.path, file.path);
            }
        }
    }

    if (dest === 'wiki') {
        return `[[${decodeURI(finalLink)}${alt && alt !== '' ? '|' + alt : ''}]]`;
    } else if (dest === 'markdown') {
        return `[${alt}](${encodeURI(finalLink)})`;
    }
};

/**
 *
 * @param sourceFilePath Path of the file, in which the links are going to be used
 * @param linkedFilePath File path, which will be referred in the source file
 * @returns
 */
function getRelativeLink(sourceFilePath: string, linkedFilePath: string) {
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
