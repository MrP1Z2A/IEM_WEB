import React from 'react';

interface PdfViewerProps {
  url: string;
  title: string;
  onClose: () => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ url, title, onClose }) => {
  if (!url) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 md:p-10 animate-in fade-in duration-300">
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-6xl h-full bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl border border-white/10 flex flex-col z-10 animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-4 truncate">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 shrink-0">
              <i className="fa-solid fa-file-pdf text-lg"></i>
            </div>
            <div className="truncate">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{title}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Document Preview</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 w-10 h-10 rounded-xl bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 hover:bg-brand-500 hover:text-white transition-all flex items-center justify-center"
              title="Open in New Tab"
            >
              <i className="fa-solid fa-up-right-from-square text-xs"></i>
            </a>

            <button 
              onClick={onClose}
              className="p-2 w-10 h-10 rounded-xl bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
              title="Close Preview"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
        </div>

        {/* PDF Content */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 relative overflow-hidden">
          <iframe 
            src={`${url}#toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full h-full border-none"
            title={title}
          />
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
            Institutional Exam Management & Learning System
          </p>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={onClose}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors"
            >
              Close
            </button>
            <a 
              href={url} 
              download 
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-brand-500 text-white text-xs font-black uppercase tracking-widest hover:bg-brand-600 shadow-lg shadow-brand-500/20 transition-all text-center"
            >
              Download PDF
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfViewer;
