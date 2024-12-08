const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const minifyHTML = (filePath) => {
    execSync(`html-minifier --collapse-whitespace --remove-comments --remove-optional-tags --output ${filePath} ${filePath}`);
};

const minifyCSS = (filePath) => {
    execSync(`cleancss -o ${filePath} ${filePath}`);
};

const minifyJS = (filePath) => {
    execSync(`terser --compress --mangle --output ${filePath} -- ${filePath}`);
};

const minifyJSON = (filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    const minified = JSON.stringify(JSON.parse(content));
    fs.writeFileSync(filePath, minified, 'utf8');
};

const processFiles = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            processFiles(filePath);
        } else {
            const ext = path.extname(filePath).toLowerCase();
            try {
                switch (ext) {
                    // case '.css':
                    //     console.log(`Minifying CSS: ${filePath}`);
                    //     minifyCSS(filePath);
                    //     break;
                    // case '.js':
                    //     console.log(`Minifying JS: ${filePath}`);
                    //     minifyJS(filePath);
                    //     break;
                    case '.json':
                        if (path.basename(filePath) === 'search-data.json') {
                            console.log(`Rewriting and minifying search-data.json: ${filePath}`);
                            const content = fs.readFileSync(filePath, 'utf8');
                            try {
                                const jsonData = JSON.parse(content);
                                const processedData = Object.keys(jsonData).reduce((acc, key) => {
                                    const record = jsonData[key];
                                    let truncatedUsage = '';
                                    if (typeof record.content === 'string') {
                                        const parts = record.content.split("Usage . ");
                                        var contentInJSON = "";
                                        if (parts.length > 1) {
                                            contentInJSON = parts[1].trim();
                                        } else {
                                            contentInJSON = record.content;
                                        }

                                        truncatedUsage = contentInJSON.length > 200
                                            ? contentInJSON.substring(0, 150) + '...'
                                            : contentInJSON;
                                    } else {
                                        console.warn(`Record for key "${key}" does not have a valid content string. Skipping.`);
                                    }

                                    acc[key] = {
                                        ...record,
                                        content: truncatedUsage,
                                    };
                                    return acc;
                                }, {});
                                console.log (filePath)
                                fs.writeFileSync(filePath, JSON.stringify(processedData), 'utf8');
                            } catch (error) {
                                console.error(`Error processing search-data.json: ${error}`);
                            }
                        } else {
                            console.log(`Minifying JSON: ${filePath}`);
                            minifyJSON(filePath);
                        }
                        break;
                    default:
                    // console.log(`Skipping: ${filePath}`);
                }
            } catch (error) {
                console.error(`Error processing file ${filePath}:`, error);
            }
        }
    }
};

const rootDir = path.resolve('_site');
processFiles(rootDir);
