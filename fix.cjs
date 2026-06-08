const fs = require('fs');
const path = require('path');

function fixButtons(dir) {
    const buttonRe = /<button\b([^>]*?)>/g;
    const typeRe = /\btype=/;
    
    let totalFixed = 0;
    let totalForm = 0;
    let totalButtons = 0;

    const files = [];

    function walk(currentDir) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules') {
                    walk(path.join(currentDir, entry.name));
                }
            } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx')) {
                files.push(path.join(currentDir, entry.name));
            }
        }
    }

    walk(dir);

    for (const filepath of files) {
        let content = fs.readFileSync(filepath, 'utf-8');
        
        // Simple form parsing by splitting
        const parts = content.split(/(<\/?form\b[^>]*>)/);
        let inForm = false;
        let modified = false;
        
        const newParts = parts.map(part => {
            if (part.startsWith('<form')) {
                inForm = true;
                return part;
            } else if (part.startsWith('</form>')) {
                inForm = false;
                return part;
            } else {
                let newPart = part.replace(buttonRe, (match, attrs) => {
                    totalButtons++;
                    if (!typeRe.test(attrs) && !attrs.includes('{...props}')) {
                        modified = true;
                        if (inForm) {
                            totalForm++;
                            return `<button${attrs} type="submit">`;
                        } else {
                            totalFixed++;
                            return `<button${attrs} type="button">`;
                        }
                    }
                    return match;
                });
                return newPart;
            }
        });

        if (modified) {
            fs.writeFileSync(filepath, newParts.join(''), 'utf-8');
        }
    }

    console.log(`Fixed ${totalFixed} normal buttons and ${totalForm} form submit buttons out of ${totalButtons} buttons.`);
}

fixButtons(path.join(__dirname, 'src'));
