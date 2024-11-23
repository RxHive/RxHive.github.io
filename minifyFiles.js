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
                    case '.css':
                        console.log(`Minifying CSS: ${filePath}`);
                        minifyCSS(filePath);
                        break;
                    case '.js':
                        console.log(`Minifying JS: ${filePath}`);
                        minifyJS(filePath);
                        break;
                    case '.json':
                        console.log(`Minifying JSON: ${filePath}`);
                        minifyJSON(filePath);
                        break;
                    default:
                        console.log(`Skipping: ${filePath}`);
                }
            } catch (error) {
                console.error(`Error processing file ${filePath}:`, error);
            }
        }
    }
};

const rootDir = path.resolve('_site');
processFiles(rootDir);