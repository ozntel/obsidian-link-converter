import LinkConverterPlugin from 'main';
import { App, TFile, Notice, normalizePath, TFolder, MarkdownView } from 'obsidian';
import { getFilesUnderPath } from './utils';

/* -------------------- LINK DETECTOR -------------------- */

type FinalFormat = 'relative-path' | 'absolute-path' | 'shortest-path';
type LinkType = 'markdown' | 'wiki' | 'wikiTransclusion' | 'mdTransclusion';

interface LinkMatch {
    type: LinkType;
    match: string;
    linkText: string;
    altOrBlockRef: string;
    sourceFilePath: string;
}

const getAllLinkMatchesInFile = async (mdFile: TFile, plugin: LinkConverterPlugin): Promise<LinkMatch[]> => {
    const linkMatches: LinkMatch[] = [];
    let fileText = await plugin.app.vault.read(mdFile);

    // --> Get All WikiLinks
    let wikiRegex = /\[\[[^\]]*?\]\]/g;
    let wikiMatches = fileText.match(wikiRegex);

    if (wikiMatches) {
        let fileRegex = /(?<=\[\[).*?(?=(\]|\|))/;
        let altRegex = /(?<=\|).*(?=]])/;

        for (let wikiMatch of wikiMatches) {
            // --> Check if it is Transclusion
            if (matchIsWikiTransclusion(wikiMatch)) {
                let fileName = getTransclusionFileName(wikiMatch);
                let blockRefMatch = getTransclusionBlockRef(wikiMatch);
                if (fileName !== '' && blockRefMatch !== '') {
                    let linkMatch: LinkMatch = {
                        type: 'wikiTransclusion',
                        match: wikiMatch,
                        linkText: fileName,
                        altOrBlockRef: blockRefMatch,
                        sourceFilePath: mdFile.path,
                    };
                    linkMatches.push(linkMatch);
                    continue;
                }
            }
            // --> Normal Internal Link
            let fileMatch = wikiMatch.match(fileRegex);
            if (fileMatch) {
                // Web links are to be skipped
                if (fileMatch[0].startsWith('http')) continue;
                let altMatch = wikiMatch.match(altRegex);
                let linkMatch: LinkMatch = {
                    type: 'wiki',
                    match: wikiMatch,
                    linkText: fileMatch[0],
                    altOrBlockRef: altMatch ? altMatch[0] : '',
                    sourceFilePath: mdFile.path,
                };
                linkMatches.push(linkMatch);
            }
        }
    }

    // --> Get All Markdown Links
    let markdownRegex = /\[([^\]]*?)\]\(([^)]*?)\)/g;
    let markdownMatches = fileText.match(markdownRegex);

    if (markdownMatches) {
        let fileRegex = /(?<=\().*(?=\))/;
        let altRegex = /(?<=\[)(^$|.*?)(?=\])/;
        for (let markdownMatch of markdownMatches) {
            // --> Check if it is Transclusion
            if (matchIsMdTransclusion(markdownMatch)) {
                let fileName = getTransclusionFileName(markdownMatch);
                let blockRefMatch = getTransclusionBlockRef(markdownMatch);
                if (fileName !== '' && blockRefMatch !== '') {
                    let linkMatch: LinkMatch = {
                        type: 'mdTransclusion',
                        match: markdownMatch,
                        linkText: fileName,
                        altOrBlockRef: blockRefMatch,
                        sourceFilePath: mdFile.path,
                    };
                    linkMatches.push(linkMatch);
                    continue;
                }
            }
            // --> Normal Internal Link
            let fileMatch = markdownMatch.match(fileRegex);
            if (fileMatch) {
                // Web links are to be skipped
                if (fileMatch[0].startsWith('http')) continue;
                let altMatch = markdownMatch.match(altRegex);
                let linkMatch: LinkMatch = {
                    type: 'markdown',
                    match: markdownMatch,
                    linkText: fileMatch[0],
                    altOrBlockRef: altMatch ? altMatch[0] : '',
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
    let fileText = await plugin.app.vault.read(mdFile);
    let newFileText =
        finalFormat === 'markdown' ? await convertWikiLinksToMarkdown(fileText, mdFile, plugin) : await convertMarkdownLinksToWikiLinks(fileText, mdFile, plugin);
    let fileStat = plugin.settings.keepMtime ? await plugin.app.vault.adapter.stat(normalizePath(mdFile.path)) : {};
    await plugin.app.vault.modify(mdFile, newFileText, fileStat);
};

// --> Command Function: Converts All Links and Saves in Current Active File
export const convertLinksInActiveFile = async (plugin: LinkConverterPlugin, finalFormat: 'markdown' | 'wiki') => {
    let mdFile: TFile = plugin.app.workspace.getActiveFile();
    if (mdFile.extension === 'md') {
        await convertLinksAndSaveInSingleFile(mdFile, plugin, finalFormat);
    } else {
        new Notice('Active File is not a Markdown File');
    }
};

// --> Convert Links under Files under a Certain Folder
export const convertLinksUnderFolder = async (folder: TFolder, plugin: LinkConverterPlugin, finalFormat: 'markdown' | 'wiki') => {
    let mdFiles: TFile[] = getFilesUnderPath(folder.path, plugin);
    let notice = new Notice('Starting link conversion', 0);
    try {
        let totalCount = mdFiles.length;
        let counter = 0;
        for (let mdFile of mdFiles) {
            counter++;
            notice.setMessage(`Converting the links in notes ${counter}/${totalCount}.`);
            // --> Skip Excalidraw and Kanban Files
            if (hasFrontmatter(plugin.app, mdFile.path, 'excalidraw-plugin') || hasFrontmatter(plugin.app, mdFile.path, 'kanban-plugin')) {
                continue;
            }
            await convertLinksAndSaveInSingleFile(mdFile, plugin, finalFormat);
        }
    } catch (err) {
        console.log(err);
    } finally {
        notice.hide();
    }
};

// --> Convert Links within editor Selection
export const convertLinksWithinSelection = async (finalFormat: 'markdown' | 'wiki', plugin: LinkConverterPlugin) => {
    let activeLeaf = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeLeaf) {
        let editor = activeLeaf.editor;
        let selection = editor.getSelection();
        let sourceFile = activeLeaf.file;
        if (selection !== '') {
            let newText: string;
            if (finalFormat === 'markdown') {
                newText = await convertWikiLinksToMarkdown(selection, sourceFile, plugin);
            } else if (finalFormat === 'wiki') {
                newText = await convertMarkdownLinksToWikiLinks(selection, sourceFile, plugin);
            }
            editor.replaceSelection(newText);
        } else {
            new Notice("You didn't select any text.");
        }
    } else {
        new Notice('There is no active leaf open.', 3000);
    }
};

// --> Command Function: Converts All Links in All Files in Vault and Save in Corresponding Files
export const convertLinksInVault = async (plugin: LinkConverterPlugin, finalFormat: 'markdown' | 'wiki') => {
    convertLinksUnderFolder(plugin.app.vault.getRoot(), plugin, finalFormat);
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
    // --> Convert Wiki Internal Links to Markdown Link
    let wikiMatches = linkMatches.filter((match) => match.type === 'wiki');
    for (let wikiMatch of wikiMatches) {
        let mdLink = createLink('markdown', wikiMatch.linkText, wikiMatch.altOrBlockRef, sourceFile, plugin);
        newMdText = newMdText.replace(wikiMatch.match, mdLink);
    }
    // --> Convert Wiki Transclusion Links to Markdown Transclusion
    let wikiTransclusions = linkMatches.filter((match) => match.type === 'wikiTransclusion');
    for (let wikiTransclusion of wikiTransclusions) {
        let wikiTransclusionLink = createLink('mdTransclusion', wikiTransclusion.linkText, wikiTransclusion.altOrBlockRef, sourceFile, plugin);
        newMdText = newMdText.replace(wikiTransclusion.match, wikiTransclusionLink);
    }
    return newMdText;
};

/* -------------------- LINKS TO WIKI CONVERTER -------------------- */

// --> Converts links within given string from MD to Wiki
const convertMarkdownLinksToWikiLinks = async (md: string, sourceFile: TFile, plugin: LinkConverterPlugin): Promise<string> => {
    let newMdText = md;
    let linkMatches: LinkMatch[] = await getAllLinkMatchesInFile(sourceFile, plugin);
    // --> Convert Markdown Internal Links to WikiLink
    let markdownMatches = linkMatches.filter((match) => match.type === 'markdown');
    for (let markdownMatch of markdownMatches) {
        let wikiLink = createLink('wiki', markdownMatch.linkText, markdownMatch.altOrBlockRef, sourceFile, plugin);
        newMdText = newMdText.replace(markdownMatch.match, wikiLink);
    }
    // --> Convert Markdown Transclusion Links to WikiLink Transclusion
    let mdTransclusions = linkMatches.filter((match) => match.type === 'mdTransclusion');
    for (let mdTransclusion of mdTransclusions) {
        let wikiTransclusionLink = createLink('wikiTransclusion', mdTransclusion.linkText, mdTransclusion.altOrBlockRef, sourceFile, plugin);
        newMdText = newMdText.replace(mdTransclusion.match, wikiTransclusionLink);
    }
    return newMdText;
};

/* -------------------- LINKS TO RELATIVE/ABSOLUTE/SHORTEST -------------------- */

export const convertLinksInFileToPreferredFormat = async (mdFile: TFile, plugin: LinkConverterPlugin, finalFormat: FinalFormat) => {
    let fileText = await plugin.app.vault.read(mdFile);
    let linkMatches: LinkMatch[] = await getAllLinkMatchesInFile(mdFile, plugin);
    for (let linkMatch of linkMatches) {
        let fileLink = decodeURI(linkMatch.linkText);
        let file = plugin.app.metadataCache.getFirstLinkpathDest(fileLink, linkMatch.sourceFilePath);
        if (file) {
            fileLink = getFileLinkInFormat(file, mdFile, plugin, finalFormat);
            fileText = fileText.replace(linkMatch.match, createLink(linkMatch.type, fileLink, linkMatch.altOrBlockRef, mdFile, plugin));
        }
    }
    let fileStat = plugin.settings.keepMtime ? await plugin.app.vault.adapter.stat(normalizePath(mdFile.path)) : {};
    await plugin.app.vault.modify(mdFile, fileText, fileStat);
};

const getFileLinkInFormat = (file: TFile, sourceFile: TFile, plugin: LinkConverterPlugin, finalFormat: FinalFormat): string => {
    let fileLink: string;
    if (finalFormat === 'absolute-path') {
        fileLink = file.path;
    } else if (finalFormat === 'relative-path') {
        fileLink = getRelativeLink(sourceFile.path, file.path);
    } else if (finalFormat === 'shortest-path') {
        let allFilesInVault = plugin.app.vault.getFiles();
        let filesWithSameName = allFilesInVault.filter((f) => f.name === file.name);
        if (filesWithSameName.length > 1) {
            fileLink = file.path;
        } else {
            fileLink = file.name;
        }
    }
    if (fileLink.endsWith('.md')) fileLink = fileLink.replace('.md', '');
    return fileLink;
};

/* -------------------- HELPERS -------------------- */

const createLink = (dest: LinkType, originalLink: string, altOrBlockRef: string, sourceFile: TFile, plugin: LinkConverterPlugin): string => {
    let finalLink = originalLink;
    let altText: string;

    let fileLink = decodeURI(finalLink);
    let file = plugin.app.metadataCache.getFirstLinkpathDest(fileLink, sourceFile.path);
    if (file && plugin.settings.finalLinkFormat !== 'not-change') finalLink = getFileLinkInFormat(file, sourceFile, plugin, plugin.settings.finalLinkFormat);

    // If final link is in markdown format and the file is md, the extension should be included
    const fileExtension = file && file.extension === 'md' ? `.${file.extension}` : '';

    if (dest === 'wiki') {
        // If alt text is same as the final link or same as file base name, it needs to be empty
        if (altOrBlockRef !== '' && altOrBlockRef !== decodeURI(finalLink)) {
            if (file && decodeURI(altOrBlockRef) === file.basename) {
                altText = '';
            } else {
                altText = '|' + altOrBlockRef;
            }
        } else {
            altText = '';
        }
        return `[[${decodeURI(finalLink)}${altText}]]`;
    } else if (dest === 'markdown') {
        // If there is no alt text specifiec and file exists, the alt text needs to be always the file base name
        if (altOrBlockRef !== '') {
            altText = altOrBlockRef;
        } else {
            altText = file ? file.basename : finalLink;
        }
        return `[${altText}](${customEncodeURI(finalLink)}${fileExtension})`;
    } else if (dest === 'wikiTransclusion') {
        return `[[${decodeURI(finalLink)}#${decodeURI(altOrBlockRef)}]]`;
    } else if (dest === 'mdTransclusion') {
        // --> To skip encoding ^
        let encodedBlockRef = altOrBlockRef;
        if (altOrBlockRef.startsWith('^')) {
            encodedBlockRef = customEncodeURI(encodedBlockRef.slice(1));
            encodedBlockRef = `^${encodedBlockRef}`;
        } else {
            encodedBlockRef = customEncodeURI(encodedBlockRef);
        }
        return `[](${customEncodeURI(finalLink)}${fileExtension}#${encodedBlockRef})`;
    }

    return '';
};

/**
 * Encode URI the same way Obsidian is doing it internally
 * 
 * @param uri 
 * @returns 
 */
function customEncodeURI(uri: string): string {
    return uri.replace(/[\\\x00\x08\x0B\x0C\x0E-\x1F ]/g, urlPart => encodeURIComponent(urlPart));
}

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

/* -------------------- TRANSCLUSIONS -------------------- */

const wikiTransclusionRegex = /\[\[([^\]]*?)#.*?\]\]/;
const wikiTransclusionFileNameRegex = /(?<=\[\[)(.*)(?=#)/;
const wikiTransclusionBlockRef = /(?<=#).*?(?=]])/;

const mdTransclusionRegex = /\[[^\]]*?]\(([^)]*?)#[^\)]*?\)/;
const mdTransclusionFileNameRegex = /(?<=\]\()(.*)(?=#)/;
const mdTransclusionBlockRef = /(?<=#).*?(?=\))/;

const matchIsWikiTransclusion = (match: string): boolean => {
    return wikiTransclusionRegex.test(match);
};

const matchIsMdTransclusion = (match: string): boolean => {
    return mdTransclusionRegex.test(match);
};

/**
 * @param match
 * @returns file name if there is a match or empty string if no match
 */
const getTransclusionFileName = (match: string): string => {
    let isWiki = wikiTransclusionRegex.test(match);
    let isMd = mdTransclusionRegex.test(match);
    if (isWiki || isMd) {
        let fileNameMatch = match.match(isWiki ? wikiTransclusionFileNameRegex : mdTransclusionFileNameRegex);
        if (fileNameMatch) return fileNameMatch[0];
    }
    return '';
};

/**
 * @param match
 * @returns block ref if there is a match or empty string if no match
 */
const getTransclusionBlockRef = (match: string) => {
    let isWiki = wikiTransclusionRegex.test(match);
    let isMd = mdTransclusionRegex.test(match);
    if (isWiki || isMd) {
        let blockRefMatch = match.match(isWiki ? wikiTransclusionBlockRef : mdTransclusionBlockRef);
        if (blockRefMatch) return blockRefMatch[0];
    }
    return '';
};
