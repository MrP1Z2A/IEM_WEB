import fs from 'fs';

const path = 'src/sms/components/HomeworkManager.tsx';
let content = fs.readFileSync(path, 'utf8');

console.log('Original content length:', content.length);

if (!content.includes("<PdfViewer")) {
  // Add the PdfViewer modal rendering just before the closing </div> of the component
  const searchPattern = "      )}\n    </div>\n  );\n}";
  const replacement = `      )}
      {previewUrl && (
        <PdfViewer
          url={previewUrl}
          title={previewTitle}
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </div>
  );
}`;
  
  if (content.includes(searchPattern)) {
      content = content.replace(searchPattern, replacement);
  } else {
      // Try again with CRLF if LF failed
      const searchPatternCRLF = "      )}\r\n    </div>\r\n  );\r\n}";
      const replacementCRLF = `      )}
      {previewUrl && (
        <PdfViewer
          url={previewUrl}
          title={previewTitle}
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </div>
  );
}`;
      content = content.replace(searchPatternCRLF, replacementCRLF);
  }
}

fs.writeFileSync(path, content);
console.log('Successfully patched src/sms/components/HomeworkManager.tsx');
console.log('New content length:', content.length);
