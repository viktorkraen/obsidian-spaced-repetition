export enum TextDirection {
    Unspecified,
    Ltr,
    Rtl,
}

type Hex = number;

/**
 * Escapes the input string so that it can be converted to a regex
 * while making sure that symbols like `?` and `*` aren't interpreted
 * as regex specials.
 * Please see https://stackoverflow.com/a/6969486 for more details
 *
 * @param str - The string to be escaped
 * @returns The escaped string
 */
export const escapeRegexString = (text: string): string =>
    text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function literalStringReplace(
    text: string,
    searchStr: string,
    replacementStr: string,
): string {
    let result: string = text;
    const startIdx: number = text.indexOf(searchStr);
    if (startIdx >= 0) {
        const startStr: string = text.substring(0, startIdx);
        const endIdx: number = startIdx + searchStr.length;
        const endStr: string = text.substring(endIdx);
        result = startStr + replacementStr + endStr;
    }
    return result;
}

/**
 * Returns the cyrb53 hash (hex string) of the input string
 * Please see https://stackoverflow.com/a/52171480 for more details
 *
 * @param str - The string to be hashed
 * @param seed - The seed for the cyrb53 function
 * @returns The cyrb53 hash (hex string) of `str` seeded using `seed`
 */
export function cyrb53(str: string, seed = 0): string {
    let h1: Hex = 0xdeadbeef ^ seed,
        h2: Hex = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convertToStringOrEmpty(v: any): string {
    let result: string = "";
    if (v != null && v != undefined) {
        result = v + "";
    }
    return result;
}

/**
 * Splits the input text into an array of lines.
 * Normalizes line endings to \n before splitting.
 *
 * @param text The input text to be split into lines.
 * @returns The array of lines from the input text.
 */
export function splitTextIntoLineArray(text: string): string[] {
    return text.replaceAll(/\r\n|\r/g, "\n").split("\n");
}

/**
 * Trims the leading whitespace from the input string and returns both the leading whitespace and the trimmed string.
 *
 * @param str The input string to be trimmed.
 * @returns A tuple where the first element is the leading whitespace and the second is the trimmed string.
 */
export function stringTrimStart(str: string): [string, string] {
    if (!str) {
        return ["", ""];
    }
    const trimmed: string = str.trimStart();
    const wsCount: number = str.length - trimmed.length;
    const ws: string = str.substring(0, wsCount);
    return [ws, trimmed];
}

// This returns [frontmatter, content]
//
// The returned content has the same number of lines as the supplied str string, but with the
// frontmatter lines (if present) blanked out.
//
// 1. We don't want the parser to see the frontmatter, as it would deem it to be part of a multi-line question
// if one started on the line immediately after the "---" closing marker.
//
// 2. The lines are blanked out rather than deleted so that line numbers are not affected
// e.g. for calls to getQuestionContext(cardLine: number)
//
export function splitNoteIntoFrontmatterAndContent(str: string): [string, string] {
    const lines = splitTextIntoLineArray(str);
    let lineIndex = 0;
    let hasFrontmatter = false;
    do {
        // Starts file with '---'
        if (lineIndex === 0 && lines[lineIndex] === "---") {
            hasFrontmatter = true;
        }
        // Line is end of front matter
        else if (hasFrontmatter && lines[lineIndex] === "---") {
            hasFrontmatter = false;
            lineIndex++;
        }
        if (hasFrontmatter) {
            lineIndex++;
        }
    } while (hasFrontmatter && lineIndex < lines.length);
    // No end of Frontmatter found
    if (hasFrontmatter) {
        lineIndex = 0;
    }

    const frontmatter: string = lines.slice(0, lineIndex).join("\n");
    const emptyLines: string[] = lineIndex > 0 ? Array(lineIndex).join(".").split(".") : [];
    const content: string = emptyLines.concat(lines.slice(lineIndex)).join("\n");

    return [frontmatter, content];
}

// Returns the index of the line that consists of the search string.
//
// A line is considered a match if it is identical to the search string, (ignoring leading and
// trailing spaces of the line)
//
export function findLineIndexOfSearchStringIgnoringWs(
    lines: string[],
    searchString: string,
): number {
    let result: number = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() == searchString) {
            result = i;
            break;
        }
    }
    return result;
}

/*
Prompted by flashcards being missed, here are some "experiments" with different frontmatter,
showing the difference in the value of CachedMetadata.frontmatter["tags"]

----------------- EXPERIMENT 1

---
tags:
  - flashcards/philosophy/philosophers
  - flashcards/toes
---

CachedMetadata.frontmatter["tags"]: flashcards/philosophy/philosophers,flashcards/toes


----------------- EXPERIMENT 2

---
tags:
  - "#flashcards/philosophy/philosophers"
---

CachedMetadata.frontmatter["tags"]: #flashcards/philosophy/philosophers


----------------- EXPERIMENT 3

---
tags:
  - "#flashcards/philosophy/philosophers"
  - "#flashcards/toes"
---

CachedMetadata.frontmatter["tags"]: #flashcardsX/philosophy/philosophers,#flashcardsX/toes


----------------- EXPERIMENT 4

---
tags:
  - #flashcards/philosophy/philosophers
---

Obsidian does not recognize that the frontmatter has any tags
(i.e. if the frontmatter includes the "#" it must be enclosed in quotes)

----------------- CONCLUSION

CachedMetadata.frontmatter["tags"]: tags are comma separated. They may or may not include the "#".
Any double quotes in the frontmatter are stripped by Obsidian and not present in this variable.

*/
export function parseObsidianFrontmatterTag(tagStr: string): string[] {
    const result: string[] = [] as string[];
    if (tagStr) {
        const tagStrList: string[] = tagStr.split(",");
        for (const tag of tagStrList) {
            if (tag !== "") {
                result.push(tag.startsWith("#") ? tag : "#" + tag);
            }
        }
    }
    return result;
}

export class MultiLineTextFinder {
    static findAndReplace(
        sourceText: string,
        searchText: string,
        replacementText: string,
    ): string | null {
        let result: string = null;

        console.log('=== MultiLineTextFinder.findAndReplace ===');
        console.log('Source text:', JSON.stringify(sourceText));
        console.log('Search text:', JSON.stringify(searchText));
        console.log('Replacement text:', JSON.stringify(replacementText));

        // Нормалізуємо текст для пошуку
        const normalizedSourceText = sourceText.replace(/\r\n/g, '\n');
        const normalizedSearchText = searchText.replace(/\r\n/g, '\n');

        console.log('Normalized source text:', JSON.stringify(normalizedSourceText));
        console.log('Normalized search text:', JSON.stringify(normalizedSearchText));

        // Спочатку спробуємо знайти точний збіг
        if (normalizedSourceText.includes(normalizedSearchText)) {
            console.log('Found exact match!');
            result = literalStringReplace(normalizedSourceText, normalizedSearchText, replacementText);
        } else {
            console.log('No exact match, trying line by line...');
            // Якщо точний збіг не знайдено, спробуємо знайти по рядках
            const sourceTextArray = splitTextIntoLineArray(normalizedSourceText);
            const searchTextArray = splitTextIntoLineArray(normalizedSearchText)
                .filter(line => line.trim() !== ''); // Видаляємо порожні рядки з пошукового тексту
            
            console.log('Source text array:', JSON.stringify(sourceTextArray));
            console.log('Search text array:', JSON.stringify(searchTextArray));
            
            // Перевіряємо, чи це картка типу HeaderBasic з роздільниками "-- --"
            const isHeaderBasicCard = searchTextArray.length > 2 && 
                searchTextArray.some(line => line.trim().startsWith('#')) && 
                searchTextArray.some(line => line.trim() === "-- --");
            
            if (isHeaderBasicCard) {
                console.log('Detected HeaderBasic card with separators');
                
                // Знаходимо заголовок (перший рядок, що починається з #)
                let headerLineIdx = -1;
                for (let i = 0; i < searchTextArray.length; i++) {
                    if (searchTextArray[i].trim().startsWith('#')) {
                        headerLineIdx = i;
                        break;
                    }
                }
                
                if (headerLineIdx !== -1) {
                    const headerLine = searchTextArray[headerLineIdx];
                    console.log('Header line:', JSON.stringify(headerLine));
                    
                    // Знаходимо заголовок у вихідному тексті
                    let sourceHeaderLineIdx = -1;
                    for (let i = 0; i < sourceTextArray.length; i++) {
                        if (sourceTextArray[i].trim() === headerLine.trim()) {
                            sourceHeaderLineIdx = i;
                            break;
                        }
                    }
                    
                    if (sourceHeaderLineIdx !== -1) {
                        console.log('Found header in source at line:', sourceHeaderLineIdx);
                        
                        // Знаходимо всі роздільники "-- --" після заголовка
                        const separatorIndices: number[] = [];
                        for (let i = sourceHeaderLineIdx + 1; i < sourceTextArray.length; i++) {
                            if (sourceTextArray[i].trim() === "-- --") {
                                separatorIndices.push(i);
                            }
                        }
                        
                        if (separatorIndices.length >= 2) {
                            console.log('Found separators at lines:', separatorIndices);
                            
                            // Визначаємо діапазон рядків для заміни
                            const startLine = sourceHeaderLineIdx;
                            const endLine = separatorIndices[separatorIndices.length - 1];
                            const linesToRemove = endLine - startLine + 1;
                            
                            console.log('Start line:', startLine);
                            console.log('End line:', endLine);
                            console.log('Lines to remove:', linesToRemove);
                            
                            const replacementTextArray = splitTextIntoLineArray(replacementText);
                            sourceTextArray.splice(startLine, linesToRemove, ...replacementTextArray);
                            result = sourceTextArray.join('\n');
                            console.log('Successfully replaced HeaderBasic card!');
                            return result;
                        }
                    }
                }
            }

            const lineNo: number | null = MultiLineTextFinder.find(
                sourceTextArray,
                searchTextArray,
            );
            
            console.log('Found at line:', lineNo);

            if (lineNo !== null) {
                // Визначаємо кількість рядків для видалення, враховуючи порожні рядки
                const endLineNo = findEndLine(sourceTextArray, lineNo, searchTextArray);
                const linesToRemove = endLineNo - lineNo + 1;
                
                console.log('Start line:', lineNo);
                console.log('End line:', endLineNo);
                console.log('Lines to remove:', linesToRemove);
                
                const replacementTextArray = splitTextIntoLineArray(replacementText);
                sourceTextArray.splice(lineNo, linesToRemove, ...replacementTextArray);
                result = sourceTextArray.join('\n');
                console.log('Successfully replaced text!');
            } else {
                console.log('Text not found in line by line search');
            }
        }
        return result;
    }

    static find(sourceText: string[], searchText: string[]): number | null {
        let result: number = null;
        let searchIdx: number = 0;
        let startLine: number = -1;
        const maxSearchIdx: number = searchText.length - 1;

        console.log('=== MultiLineTextFinder.find ===');
        
        // Спочатку спробуємо знайти всі рядки підряд
        for (let sourceIdx = 0; sourceIdx < sourceText.length; sourceIdx++) {
            const sourceLine: string = sourceText[sourceIdx].trim();
            const searchLine: string = searchText[searchIdx].trim();

            console.log(`Comparing line ${sourceIdx}:`);
            console.log('Source:', JSON.stringify(sourceLine));
            console.log('Search:', JSON.stringify(searchLine));

            // Якщо знайшли перший рядок
            if (searchIdx === 0 && sourceLine === searchLine) {
                startLine = sourceIdx;
                searchIdx++;
                console.log('Found start at line:', startLine);
                continue;
            }

            // Якщо ми вже знайшли початок
            if (startLine !== -1) {
                // Пропускаємо порожні рядки
                if (sourceLine === '') {
                    console.log('Skipping empty line in sequence');
                    continue;
                }

                // Перевіряємо збіг поточного рядка
                if (sourceLine === searchLine) {
                    console.log('Match found in sequence');
                    if (searchIdx === maxSearchIdx) {
                        result = startLine;
                        console.log('Found complete match starting at line:', result);
                        break;
                    }
                    searchIdx++;
                } else {
                    // Якщо послідовність перервалась, починаємо спочатку
                    console.log('Sequence broken, resetting');
                    searchIdx = 0;
                    startLine = -1;
                    // Перевіряємо, чи поточний рядок не є початком нової послідовності
                    if (sourceLine === searchText[0].trim()) {
                        startLine = sourceIdx;
                        searchIdx = 1;
                        console.log('Found new start at line:', startLine);
                    }
                }
            }
        }
        
        // Якщо не знайшли всі рядки підряд, спробуємо знайти ключові рядки
        if (result === null && searchText.length > 2) {
            console.log('Trying to find key lines...');
            
            // Шукаємо перший рядок
            const firstLine = searchText[0].trim();
            // Шукаємо останній рядок
            const lastLine = searchText[searchText.length - 1].trim();
            
            // Шукаємо перший рядок у вихідному тексті
            let firstLineIdx = -1;
            for (let i = 0; i < sourceText.length; i++) {
                if (sourceText[i].trim() === firstLine) {
                    firstLineIdx = i;
                    break;
                }
            }
            
            // Якщо знайшли перший рядок, шукаємо останній рядок після нього
            if (firstLineIdx !== -1) {
                for (let i = firstLineIdx + 1; i < sourceText.length; i++) {
                    if (sourceText[i].trim() === lastLine) {
                        // Знайшли обидва рядки, повертаємо індекс першого
                        result = firstLineIdx;
                        console.log('Found key lines match starting at line:', result);
                        break;
                    }
                }
            }
        }
        
        return result;
    }
}

// Допоміжна функція для знаходження кінцевого рядка
function findEndLine(sourceText: string[], startLine: number, searchText: string[]): number {
    let endLine = startLine;
    let searchIdx = 0;
    
    console.log('=== findEndLine ===');
    console.log('Start line:', startLine);
    console.log('Search text:', JSON.stringify(searchText));
    
    // Якщо пошуковий текст містить більше 2 рядків, і перший та останній рядки є "-- --",
    // то ми шукаємо останній "-- --" після startLine
    if (searchText.length > 2 && 
        searchText[0].trim() === "-- --" && 
        searchText[searchText.length - 1].trim() === "-- --") {
        
        console.log('Special case: searching for last separator');
        
        // Шукаємо останній "-- --" після startLine
        for (let i = sourceText.length - 1; i >= startLine; i--) {
            if (sourceText[i].trim() === "-- --") {
                endLine = i;
                console.log('Found last separator at line:', endLine);
                return endLine;
            }
        }
    }
    
    // Стандартний пошук
    for (let i = startLine; i < sourceText.length; i++) {
        const sourceLine = sourceText[i].trim();
        
        // Пропускаємо порожні рядки
        if (sourceLine === '') {
            continue;
        }
        
        // Якщо знайшли збіг з пошуковим рядком
        if (sourceLine === searchText[searchIdx].trim()) {
            endLine = i;
            searchIdx++;
            
            // Якщо знайшли всі пошукові рядки
            if (searchIdx === searchText.length) {
                console.log('Found all search lines, end line:', endLine);
                break;
            }
        }
    }
    
    console.log('End line:', endLine);
    return endLine;
}
