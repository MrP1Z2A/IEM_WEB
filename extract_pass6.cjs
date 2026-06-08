const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:/Users/yeyin/AppData/Local/Temp/react-doctor-309e0074-8b92-4a88-80a4-507f9a95a4ff/diagnostics.json', 'utf8'));
const targetRules = ['js-combine-iterations', 'click-events-have-key-events', 'no-static-element-interactions'];
const issues = {};
targetRules.forEach(rule => issues[rule] = []);
data.forEach(issue => {
  if (targetRules.includes(issue.ruleId || issue.id || issue.rule)) {
    issues[issue.ruleId || issue.id || issue.rule].push(issue.filePath + ':' + issue.line);
  }
});
fs.writeFileSync('pass6_issues.json', JSON.stringify(issues, null, 2));
console.log('Extracted issues to pass6_issues.json');
