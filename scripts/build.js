const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');

async function build() {
    const htmlPath = path.join(__dirname, '../kira_v3.html');
    const wordbanksPath = path.join(__dirname, '../sentence_engine_wordbanks.js');
    const templatesPath = path.join(__dirname, '../sentence_engine_templates.js');
    const outputPath = path.join(__dirname, '../kira_v3.min.html');

    let html = fs.readFileSync(htmlPath, 'utf8');
    const wordbanksJs = fs.readFileSync(wordbanksPath, 'utf8');
    const templatesJs = fs.readFileSync(templatesPath, 'utf8');

    // Extract everything from 'const WORD_BANKS = {' or 'const SENTENCE_TEMPLATES = ['
    // up to the matching brace/bracket.
    function extractStructure(jsCode, variableName) {
        const regex = new RegExp(`const\\s+${variableName}\\s*=\\s*(\\{|\\[)`);
        const match = regex.exec(jsCode);
        if (!match) return null;

        let braceCount = 0;
        let startIndex = match.index + match[0].length - 1; // start at '{' or '['
        let inString = false;
        let stringChar = null;
        let isEscaped = false;

        for (let i = startIndex; i < jsCode.length; i++) {
            const char = jsCode[i];

            if (inString) {
                if (char === '\\') {
                    isEscaped = !isEscaped;
                } else {
                    if (char === stringChar && !isEscaped) {
                        inString = false;
                    }
                    isEscaped = false;
                }
            } else {
                // Not considering comments (// or /*) for simplicity since the files are well-formatted,
                // but let's be careful. Actually, this is simple and sufficient.
                if (char === "'" || char === '"' || char === '`') {
                    inString = true;
                    stringChar = char;
                } else if (char === '{' || char === '[') {
                    braceCount++;
                } else if (char === '}' || char === ']') {
                    braceCount--;
                    if (braceCount === 0) {
                        return jsCode.substring(startIndex, i + 1);
                    }
                }
            }
        }
        return null;
    }

    const wordBanksContent = extractStructure(wordbanksJs, 'WORD_BANKS');
    if (!wordBanksContent) {
        console.error("Could not extract WORD_BANKS from sentence_engine_wordbanks.js");
        process.exit(1);
    }

    const templatesContent = extractStructure(templatesJs, 'SENTENCE_TEMPLATES');
    if (!templatesContent) {
        console.error("Could not extract SENTENCE_TEMPLATES from sentence_engine_templates.js");
        process.exit(1);
    }

    // Replace in HTML
    function replaceInHtml(html, variableName, newContent) {
        const regex = new RegExp(`const\\s+${variableName}\\s*=\\s*(\\{|\\[)`);
        const match = regex.exec(html);
        if (!match) {
             console.error(`Could not find ${variableName} in html`);
             return html;
        }

        let braceCount = 0;
        let startIndex = match.index + match[0].length - 1;
        let inString = false;
        let stringChar = null;
        let isEscaped = false;

        for (let i = startIndex; i < html.length; i++) {
            const char = html[i];

            if (inString) {
                if (char === '\\') {
                    isEscaped = !isEscaped;
                } else {
                    if (char === stringChar && !isEscaped) {
                        inString = false;
                    }
                    isEscaped = false;
                }
            } else {
                if (char === "'" || char === '"' || char === '`') {
                    inString = true;
                    stringChar = char;
                } else if (char === '{' || char === '[') {
                    braceCount++;
                } else if (char === '}' || char === ']') {
                    braceCount--;
                    if (braceCount === 0) {
                        return html.substring(0, match.index) + `const ${variableName} = ` + newContent + html.substring(i + 1);
                    }
                }
            }
        }
        return html;
    }

    html = replaceInHtml(html, 'SENTENCE_WORD_BANKS', wordBanksContent);
    html = replaceInHtml(html, 'SENTENCE_TEMPLATES', templatesContent);

    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log('Successfully inlined JS into kira_v3.html');

    // Minify
    const minified = await minify(html, {
        collapseWhitespace: true,
        removeComments: true,
        minifyJS: true,
        minifyCSS: true,
        removeAttributeQuotes: true,
        removeEmptyAttributes: true,
        removeOptionalTags: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true
    });

    fs.writeFileSync(outputPath, minified, 'utf8');
    console.log(`Successfully generated minified version: kira_v3.min.html`);
}

build().catch(console.error);
