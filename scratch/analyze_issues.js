const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../tmp/diagnostics.json');
let content = fs.readFileSync(filePath, 'utf8');

// Strip UTF-8 BOM if present
if (content.charCodeAt(0) === 0xFEFF) {
  content = content.slice(1);
}

// Check for UTF-16 BOM and convert if needed
if (content.charCodeAt(0) === 0xFFFE || content.charCodeAt(0) === 0xFEFF) {
  // It might be UTF-16, but fs.readFileSync with utf8 should have handled it or errored.
  // Let's print out if it looks weird.
}

let data;
try {
  data = JSON.parse(content);
} catch (e) {
  console.error("Failed to parse JSON:", e.message);
  // Let's print first 100 characters to debug
  console.log("First 100 chars:", JSON.stringify(content.slice(0, 100)));
  process.exit(1);
}

// React doctor json format:
// Let's see the structure of data. It could be an array of diagnostics or { diagnostics: [...] } or { project: { score: 15 }, diagnostics: [...] }
console.log("Keys in JSON:", Object.keys(data));
if (data.score !== undefined) {
  console.log("Score in JSON:", data.score);
}

const diagnostics = data.diagnostics || data.issues || (Array.isArray(data) ? data : []);
console.log("Total diagnostics:", diagnostics.length);

const rules = {};
for (const diag of diagnostics) {
  const ruleId = diag.ruleId || diag.code || diag.rule || "unknown";
  const severity = diag.severity || "unknown";
  const filePath = diag.filePath || (diag.location && diag.location.file) || "unknown";
  
  if (!rules[ruleId]) {
    rules[ruleId] = {
      ruleId,
      severity,
      count: 0,
      files: new Set()
    };
  }
  rules[ruleId].count++;
  rules[ruleId].files.add(filePath);
}

const sortedRules = Object.values(rules).sort((a, b) => {
  if (a.severity !== b.severity) {
    return a.severity === 'error' ? -1 : 1;
  }
  return a.count - b.count; // Smallest counts first to target rules we can eliminate easily
});

console.log("\n--- Violations by Rule ---");
for (const r of sortedRules) {
  console.log(`[${r.severity.toUpperCase()}] ${r.ruleId}: ${r.count} occurrences across ${r.files.size} files`);
  // If count is small, list the files/lines
  if (r.count <= 10) {
    const matching = diagnostics.filter(d => (d.ruleId || d.code || d.rule) === r.ruleId);
    for (const m of matching) {
      const f = m.filePath || (m.location && m.location.file) || "unknown";
      const line = m.line || (m.location && m.location.start && m.location.start.line) || "?";
      console.log(`  - ${f}:${line}`);
    }
  }
}
