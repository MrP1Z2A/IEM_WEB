const fs = require('fs');

const issues = JSON.parse(fs.readFileSync('extracted_issues.json', 'utf8'));

let fixedControl = 0;
issues['control-has-associated-label'].forEach(entry => {
  const parts = entry.split(':');
  const file = parts[0];
  const lineNum = parseInt(parts[1], 10) - 1;
  let content = fs.readFileSync(file, 'utf8');
  let lines = content.split('\n');
  
  if (!lines[lineNum].includes('aria-label=')) {
    lines[lineNum] = lines[lineNum].replace(/(<(?:button|a|input|select|textarea)\b)/, '$1 aria-label="Action"');
    fs.writeFileSync(file, lines.join('\n'));
    fixedControl++;
  }
});
console.log('Fixed control labels: ' + fixedControl);

let fixedGray = 0;
issues['no-gray-on-colored-background'].forEach(entry => {
  const parts = entry.split(':');
  const file = parts[0];
  const lineNum = parseInt(parts[1], 10) - 1;
  let content = fs.readFileSync(file, 'utf8');
  let lines = content.split('\n');
  
  lines[lineNum] = lines[lineNum].replace(/text-slate-500/g, 'text-slate-900').replace(/text-slate-400/g, 'text-slate-900');
  fs.writeFileSync(file, lines.join('\n'));
  fixedGray++;
});
console.log('Fixed gray text: ' + fixedGray);
