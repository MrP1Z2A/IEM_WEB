const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/lms/components/ClassandCoursesmanager/ClassesGrid.tsx',
  'src/sms/components/ClassGroupManagement.tsx',
  'src/lms/components/Messaging.tsx',
  'src/lms/components/TeacherExams.tsx',
  'src/sms/components/Modals/PdfViewer.tsx',
  'src/parent/components/InstitutionHub.tsx',
  'src/parent/App.tsx',
  'src/lms/components/Livecalender.tsx',
  'src/lms/components/PdfViewer.tsx',
  'src/lms/App.tsx'
];

filesToFix.forEach(relPath => {
  const filepath = path.join(__dirname, relPath);
  if (fs.existsSync(filepath)) {
    let content = fs.readFileSync(filepath, 'utf-8');
    
    // We replace specific patterns known to be gray on color
    // e.g. text-slate-900 with text-white if there's a colored bg like bg-[#4ea59d]
    // Or simpler: just do a global replace for text-slate-900 to text-white in classes that have bg-rose-500, bg-indigo-500, etc.
    
    // We can use a regex to find className="..."
    const classRe = /className="([^"]+)"/g;
    let modified = false;
    
    content = content.replace(classRe, (match, classes) => {
      // Check if it contains a colored background and a gray text
      const hasColoredBg = /\bbg-(rose|indigo|emerald|blue|purple|brand)-[456]00\b|bg-\[#[a-fA-F0-9]+\]/.test(classes) || /hover:bg-(rose|indigo|emerald|blue|purple|brand)-[456]00\b|hover:bg-\[#[a-fA-F0-9]+\]/.test(classes);
      const hasGrayText = /\btext-(slate|gray|zinc|neutral|stone)-[4-9]00\b|\bhover:text-(slate|gray|zinc|neutral|stone)-[4-9]00\b/.test(classes);
      
      if (hasColoredBg && hasGrayText) {
         // Replace text-slate-* with text-white
         let newClasses = classes.replace(/\btext-(slate|gray|zinc|neutral|stone)-[4-9]00\b/g, 'text-white')
                                 .replace(/\bhover:text-(slate|gray|zinc|neutral|stone)-[4-9]00\b/g, 'hover:text-white');
         modified = true;
         return `className="${newClasses}"`;
      }
      return match;
    });
    
    if (modified) {
      fs.writeFileSync(filepath, content, 'utf-8');
      console.log(`Fixed ${filepath}`);
    }
  }
});
