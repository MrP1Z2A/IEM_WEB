import React, { useState, useEffect, useRef, useCallback } from 'react';

interface TimetablePanelProps {
  activeClassId: string;
  supabase: any;
  notify: (msg: string) => void;
}

export const TimetablePanel: React.FC<TimetablePanelProps> = ({
  activeClassId,
  supabase,
  notify,
}) => {
  const TIMETABLE_BUCKET = 'class_timetable';
  const [isTimetableViewOpen, setIsTimetableViewOpen] = useState(false);
  const [isTimetableUploading, setIsTimetableUploading] = useState(false);
  const [isTimetableLoading, setIsTimetableLoading] = useState(false);
  const [timetableFiles, setTimetableFiles] = useState<Array<{ name: string; path: string; url: string }>>([]);
  const timetableInputRef = useRef<HTMLInputElement | null>(null);

  const loadTimetableFiles = useCallback(async (classId: string) => {
    setIsTimetableLoading(true);
    try {
      const folder = `class-${classId}`;
      const { data, error } = await supabase.storage
        .from(TIMETABLE_BUCKET)
        .list(folder, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      const mapped = (data || []).reduce((acc: any[], file: any) => {
        if (file?.name && file.name.toLowerCase().endsWith('.pdf')) {
          const path = `${folder}/${file.name}`;
          const { data: publicData } = supabase.storage.from(TIMETABLE_BUCKET).getPublicUrl(path);
          if (publicData?.publicUrl) {
            acc.push({ name: file.name, path, url: publicData.publicUrl });
          }
        }
        return acc;
      }, []);

      setTimetableFiles(mapped);
    } catch (error: any) {
      console.error('Failed to load timetable files:', error);
      notify(`Failed to load timetable files: ${error?.message || 'Unknown error'}`);
      setTimetableFiles([]);
    } finally {
      setIsTimetableLoading(false);
    }
  }, [supabase, notify]);

  useEffect(() => {
    if (!activeClassId) {
      setTimetableFiles([]);
      setIsTimetableViewOpen(false);
      return;
    }
    void loadTimetableFiles(activeClassId);
  }, [activeClassId, loadTimetableFiles]);

  const guessFileNameFromUrl = useCallback((url: string, fallback = 'downloaded-file') => {
    try {
      const parsedUrl = new URL(url);
      const segment = parsedUrl.pathname.split('/').filter(Boolean).pop() || fallback;
      return decodeURIComponent(segment);
    } catch {
      return fallback;
    }
  }, []);

  const downloadFileDirectly = useCallback(async (url: string, fallbackName?: string) => {
    if (!url) return;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed with status ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fallbackName || guessFileNameFromUrl(url);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError: any) {
      notify(downloadError?.message || 'Failed to download file.');
    }
  }, [guessFileNameFromUrl, notify]);

  const uploadTimetablePdf = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeClassId) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      notify('Only PDF files are allowed.');
      event.target.value = '';
      return;
    }

    setIsTimetableUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `class-${activeClassId}/${Date.now()}-${safeName}`;

      const { error } = await supabase.storage
        .from(TIMETABLE_BUCKET)
        .upload(path, file, {
          upsert: false,
          contentType: 'application/pdf',
          cacheControl: '3600',
        });

      if (error) throw error;

      notify('Timetable PDF uploaded successfully.');
      setIsTimetableViewOpen(true);
      await loadTimetableFiles(activeClassId);
    } catch (error: any) {
      console.error('Timetable PDF upload failed:', error);
      notify(`Upload failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsTimetableUploading(false);
      event.target.value = '';
    }
  };

  const deleteTimetablePdf = async (filePath: string) => {
    if (!activeClassId) return;
    try {
      const { error } = await supabase.storage
        .from(TIMETABLE_BUCKET)
        .remove([filePath]);

      if (error) throw error;

      setTimetableFiles(prev => prev.filter(file => file.path !== filePath));
      notify('Timetable PDF deleted.');
    } catch (error: any) {
      console.error('Failed to delete timetable PDF:', error);
      notify(`Delete failed: ${error?.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-premium">
      <button
        type="button" onClick={() => setIsTimetableViewOpen(prev => !prev)}
        title={isTimetableViewOpen ? 'Click to collapse timetable folder' : 'Click to expand timetable folder'}
        className="inline-flex items-center gap-3 px-3 py-2 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-black uppercase tracking-[0.18em] text-slate-700 hover:text-brand-500 dark:text-slate-200 dark:hover:text-brand-300 cursor-pointer"
      >
        <span className={`w-8 h-8 rounded-full flex items-center justify-center border ${isTimetableViewOpen ? 'bg-brand-500 border-brand-400 text-white shadow-lg shadow-brand-500/40' : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-200'}`}>
          <i className={`fas ${isTimetableViewOpen ? 'fa-chevron-down' : 'fa-chevron-right'} text-sm`}></i>
        </span>
        <span className={`${isTimetableViewOpen ? 'text-brand-500 dark:text-brand-400' : ''}`}>Timetable Folder</span>
        <span className="text-[10px] sm:text-xs font-bold tracking-normal normal-case text-brand-600 dark:text-brand-300">
          {isTimetableViewOpen ? 'Click arrow to collapse' : 'Click arrow to expand'}
        </span>
      </button>

      {isTimetableViewOpen && (
        <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 space-y-3">
          <button
            type="button" onClick={() => timetableInputRef.current?.click()}
            disabled={isTimetableUploading}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white ${isTimetableUploading ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-500'}`}
          >
            {isTimetableUploading ? 'Uploading PDF...' : 'Upload PDF File'}
          </button>
          <input aria-label="Action"
            ref={timetableInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={uploadTimetablePdf}
            className="hidden"
          />

          <div className="flex flex-wrap gap-2">
            {isTimetableLoading && (
              <span className="text-xs font-semibold text-slate-500">Loading timetable files...</span>
            )}

            {!isTimetableLoading && timetableFiles.length === 0 && (
              <span className="text-xs font-semibold text-slate-500">No PDF uploaded yet.</span>
            )}

            {!isTimetableLoading && timetableFiles.map(file => (
              <div
                key={file.path}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              >
                <button
                  type="button"
                  onClick={() => void downloadFileDirectly(file.url, file.name)}
                  className="text-xs font-black uppercase tracking-widest text-brand-500 hover:text-brand-600"
                  title={file.name}
                >
                  {file.name.length > 24 ? `${file.name.slice(0, 24)}...` : file.name}
                </button>
                <button aria-label="Action"
                  type="button" onClick={() => void deleteTimetablePdf(file.path)}
                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 flex items-center justify-center"
                  title="Delete PDF"
                >
                  <i className="fas fa-trash text-xs"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
