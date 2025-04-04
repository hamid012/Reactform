"use strict";
// These are to assist in keeping clean language in the application
Object.defineProperty(exports, "__esModule", { value: true });
exports.shorten = shorten;
exports.filterBadWords = filterBadWords;
const DIACRITICS_MAP = {
    a: 'aàáâãäåā',
    c: 'cçćč',
    e: 'eèéêëēėę',
    i: 'iìíîïīį',
    o: 'oòóôõöøō',
    u: 'uùúûüū',
    n: 'nñń'
};
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function shorten(input, maxLength) {
    if (input.length > maxLength) {
        return input.slice(0, maxLength) + '...'; // Slice the string and add ellipsis
    }
    return input;
}
function buildDiacriticRegex(word) {
    let pattern = '';
    for (const char of word) {
        const lowerChar = char.toLowerCase();
        if (DIACRITICS_MAP[lowerChar]) {
            // Build a character class that includes the base letter and its diacritic variants.
            pattern += `[${DIACRITICS_MAP[lowerChar]}]`;
        }
        else {
            pattern += escapeRegExp(char);
        }
    }
    return pattern;
}
function filterBadWords(text, replacements) {
    let filteredText = text;
    for (const [badWord, sillyWord] of Object.entries(replacements)) {
        // Build a regex pattern for the banned word that accounts for diacritics.
        const pattern = buildDiacriticRegex(badWord);
        // Notice: We are not using word boundaries here so that extra letters surrounding the banned word are caught.
        const regex = new RegExp(pattern, 'gi');
        filteredText = filteredText.replace(regex, sillyWord);
    }
    return filteredText;
}
