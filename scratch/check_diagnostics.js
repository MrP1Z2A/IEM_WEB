const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('tmp/diagnostics.json', 'utf8'));
const diagnostics = data.projects[0].diagnostics;

const errors = [];
const warnings = [];

diagnostics.forEach(d => {
  if (d.severity === 'error') {
    errors.push(d);
  } else {
    warnings.push(d);
  }
});

const uniqueErrorRules = Array.from(new Set(errors.map(d => d.rule)));
const uniqueWarningRules = Array.from(new Set(warnings.map(d => d.rule)));

const errorRulesCounts = {};
errors.forEach(d => {
  errorRulesCounts[d.rule] = (errorRulesCounts[d.rule] || 0) + 1;
});

const warningRulesCounts = {};
warnings.forEach(d => {
  warningRulesCounts[d.rule] = (warningRulesCounts[d.rule] || 0) + 1;
});

const score = Math.max(0, Math.round(100 - 1.5 * uniqueErrorRules.length - 0.75 * uniqueWarningRules.length));

console.log('--- DIAGNOSTICS ANALYSIS ---');
console.log(`Total Diagnostics: ${diagnostics.length}`);
console.log(`Errors: ${errors.length} (unique rules: ${uniqueErrorRules.length})`);
console.log(`Warnings: ${warnings.length} (unique rules: ${uniqueWarningRules.length})`);
console.log(`Estimated Score: ${score}/100`);

console.log('\n--- ERROR RULES ---');
uniqueErrorRules.forEach(rule => {
  console.log(`- ${rule}: ${errorRulesCounts[rule]} occurrences`);
});

console.log('\n--- WARNING RULES ---');
uniqueWarningRules.forEach(rule => {
  console.log(`- ${rule}: ${warningRulesCounts[rule]} occurrences`);
});
