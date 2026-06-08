import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ResourcesPanelProps {
  activeClassId: string;
  focusCourse: { id: string; name: string } | null | undefined;
  schoolId: string | undefined;
  supabase: any;
  notify: (msg: string) => void;
}

const COURSE_RESOURCES_BUCKET = 'resources';
const FOLDER_MARKER_FILE = '__folder__.pdf';
const FOLDER_FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.xml,.jpg,.jpeg,.png,.gif,.webp,.svg,.mp3,.wav,.mp4,.mov,.zip,.rar,.7z,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/json,image/*,audio/*,video/*,application/zip,application/x-rar-compressed,application/x-7z-compressed';

export const ResourcesPanel: React.FC<ResourcesPanelProps> = ({
  activeClassId,
  focusCourse,
  schoolId,
  supabase,
  notify,
}) => {
  const [isCourseResourcesOpen, setIsCourseResourcesOpen] = useState(true);
  const [newCourseFolderName, setNewCourseFolderName] = useState('');
  const [isCourseFolderCreating, setIsCourseFolderCreating] = useState(false);
  const [isCourseFoldersLoading, setIsCourseFoldersLoading] = useState(false);
  const [courseFolders, setCourseFolders] = useState<Array<{ name: string; filesCount: number }>>([]);
  const [openCourseFolders, setOpenCourseFolders] = useState<Record<string, boolean>>({});
  const [courseFolderFiles, setCourseFolderFiles] = useState<Record<string, Array<{ name: string; path: string; url: string; size: number }>>>({});
  const [uploadingCourseFolderName, setUploadingCourseFolderName] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => Promise<void> } | null>(null);
  const [isConfirmActionSubmitting, setIsConfirmActionSubmitting] = useState(false);

  const courseFolderUploadRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  const loadFilesForCourseFolder = useCallback(async (folderName: string) => {
    if (!activeClassId || !focusCourse?.id || !schoolId) return;

    try {
      const { data, error } = await supabase
        .from('resources_buckets')
        .select('*')
        .eq('school_id', schoolId)
        .eq('class_id', activeClassId)
        .eq('class_course_id', focusCourse.id)
        .eq('metadata->>type', 'file')
        .eq('metadata->>folder', folderName);

      if (error) throw error;

      const files = (data || []).map((res: any) => ({
        id: res.id,
        name: res.name || 'Untitled File',
        path: res.image_url || (res.metadata as any)?.file_url || '',
        url: res.image_url || (res.metadata as any)?.file_url || '',
        size: Number((res.metadata as any)?.size || 0),
      }));

      setCourseFolderFiles(prev => ({ ...prev, [folderName]: files }));
    } catch (error: any) {
      console.error('Failed to load folder files from DB:', error);
      notify(`Failed to load folder files: ${error?.message || 'Unknown error'}`);
    }
  }, [activeClassId, focusCourse, schoolId, supabase, notify]);

  const loadCourseFolders = useCallback(async () => {
    if (!activeClassId || !focusCourse?.id || !schoolId) {
      setCourseFolders([]);
      setOpenCourseFolders({});
      setCourseFolderFiles({});
      setIsCourseFoldersLoading(false);
      return;
    }

    setIsCourseFoldersLoading(true);

    try {
      const { data, error } = await supabase
        .from('resources_buckets')
        .select('*')
        .eq('school_id', schoolId)
        .eq('class_id', activeClassId)
        .eq('class_course_id', focusCourse.id)
        .eq('metadata->>type', 'folder');

      if (error) throw error;

      const folderRecords = data || [];
      const nextFolders: Array<{ name: string; filesCount: number }> = [];

      for (const res of folderRecords) {
        const folderName = res.name;
        const { count, error: countError } = await supabase
          .from('resources_buckets')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('class_id', activeClassId)
          .eq('class_course_id', focusCourse.id)
          .eq('metadata->>type', 'file')
          .eq('metadata->>folder', folderName);

        if (countError) console.warn('Failed to count files for folder:', folderName, countError);
        nextFolders.push({ name: folderName, filesCount: count || 0 });
      }

      nextFolders.sort((a, b) => a.name.localeCompare(b.name));
      setCourseFolders(nextFolders);
    } catch (error: any) {
      console.error('Failed to load course folders from DB:', error);
      notify(`Failed to load course folders: ${error?.message || 'Unknown error'}`);
      setCourseFolders([]);
    } finally {
      setIsCourseFoldersLoading(false);
    }
  }, [activeClassId, focusCourse, schoolId, supabase, notify]);

  useEffect(() => {
    void loadCourseFolders();
  }, [loadCourseFolders]);

  const createCourseFolder = useCallback(async () => {
    if (!activeClassId || !focusCourse?.id || !schoolId) {
      notify('Select class and course first.');
      return;
    }

    const normalizedName = newCourseFolderName.trim().replace(/[\\/:*?"<>|]+/g, '_');
    if (!normalizedName) {
      notify('Enter a folder name.');
      return;
    }

    setIsCourseFolderCreating(true);
    try {
      const keepPath = `course_folders/${activeClassId}/${focusCourse.id}/${normalizedName}/${FOLDER_MARKER_FILE}`;
      const marker = new Blob([new Uint8Array([37, 80, 68, 70])], { type: 'application/pdf' });
      await supabase.storage
        .from(COURSE_RESOURCES_BUCKET)
        .upload(keepPath, marker, {
          upsert: true,
          contentType: 'application/pdf',
        });

      const { data: publicUrlData } = supabase.storage.from(COURSE_RESOURCES_BUCKET).getPublicUrl(keepPath);

      const { error: dbError } = await supabase
        .from('resources_buckets')
        .insert([{
          school_id: schoolId,
          class_id: activeClassId,
          class_course_id: focusCourse.id,
          name: normalizedName,
          metadata: {
            type: 'folder',
            content: `Resource folder for ${focusCourse.name}`,
            folder: null,
            size: 0
          },
          image_url: publicUrlData?.publicUrl || null
        }]);

      if (dbError) throw dbError;

      setNewCourseFolderName('');
      await loadCourseFolders();
      notify(`Folder "${normalizedName}" created.`);
    } catch (error: any) {
      console.error('Failed to create folder:', error);
      notify(`Failed to create folder: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsCourseFolderCreating(false);
    }
  }, [activeClassId, focusCourse, schoolId, newCourseFolderName, loadCourseFolders, supabase, notify]);

  const toggleCourseFolderOpen = useCallback(async (folderName: string) => {
    const nextOpen = !openCourseFolders[folderName];
    setOpenCourseFolders(prev => ({ ...prev, [folderName]: nextOpen }));
    if (!nextOpen) return;

    try {
      await loadFilesForCourseFolder(folderName);
    } catch (error: any) {
      console.error('Failed to load folder files:', error);
      notify(`Failed to load folder files: ${error?.message || 'Unknown error'}`);
    }
  }, [openCourseFolders, loadFilesForCourseFolder, notify]);

  const uploadFilesToCourseFolder = useCallback(async (folderName: string, files: FileList | null) => {
    if (!activeClassId || !focusCourse?.id || !schoolId || !files?.length) return;

    const selectedFiles = Array.from(files);
    const oversized = selectedFiles.find(file => file.size > 200 * 1024 * 1024);
    if (oversized) {
      notify(`File too large: ${oversized.name}. Max size is 200MB.`);
      return;
    }

    setUploadingCourseFolderName(folderName);
    try {
      for (const file of selectedFiles) {
        const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `course_folders/${activeClassId}/${focusCourse.id}/${folderName}/${Date.now()}-${sanitized}`;
        
        const { error: uploadError } = await supabase.storage
          .from(COURSE_RESOURCES_BUCKET)
          .upload(path, file, {
            upsert: false,
            contentType: file.type || undefined,
          });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from(COURSE_RESOURCES_BUCKET).getPublicUrl(path);
        const publicUrl = publicUrlData?.publicUrl;

        const { error: dbError } = await supabase.from('resources_buckets').insert([{
          school_id: schoolId,
          class_id: activeClassId,
          class_course_id: focusCourse.id,
          name: file.name,
          metadata: {
            type: 'file',
            content: `Learning material: ${file.name}`,
            file_url: publicUrl,
            folder: folderName,
            size: file.size,
            mime_type: file.type
          },
          image_url: publicUrl || null
        }]);

        if (dbError) throw dbError;
      }

      await loadFilesForCourseFolder(folderName);
      await loadCourseFolders();
      notify(`Uploaded ${selectedFiles.length} file(s) to "${folderName}".`);
    } catch (error: any) {
      console.error('Failed to upload files:', error);
      notify(`Failed to upload files: ${error?.message || 'Unknown error'}`);
    } finally {
      setUploadingCourseFolderName(null);
    }
  }, [activeClassId, focusCourse, schoolId, loadFilesForCourseFolder, loadCourseFolders, supabase, notify]);

  const deleteCourseFolder = async (folderName: string) => {
    setConfirmDialog({
      message: `Are you sure you want to delete folder "${folderName}" and all its contents?`,
      onConfirm: async () => {
        setIsConfirmActionSubmitting(true);
        try {
          await supabase
            .from('resources_buckets')
            .delete()
            .eq('school_id', schoolId)
            .eq('class_id', activeClassId)
            .eq('class_course_id', focusCourse?.id)
            .or(`name.eq."${folderName}",metadata->>folder.eq."${folderName}"`);

          const folderPath = `course_folders/${activeClassId}/${focusCourse?.id}/${folderName}`;
          const listResult = await supabase.storage.from(COURSE_RESOURCES_BUCKET).list(folderPath, { limit: 1000 });
          const filesToDelete = (listResult.data || []).map((f: any) => `${folderPath}/${f.name}`);
          if (filesToDelete.length > 0) {
            await supabase.storage.from(COURSE_RESOURCES_BUCKET).remove(filesToDelete);
          }

          await loadCourseFolders();
          notify(`Deleted folder "${folderName}"`);
        } catch (error: any) {
          console.error('Failed to delete folder:', error);
          notify(`Failed to delete folder: ${error?.message || 'Unknown error'}`);
        } finally {
          setIsConfirmActionSubmitting(false);
          setConfirmDialog(null);
        }
      }
    });
  };

  const deleteCourseFile = async (folderName: string, file: any) => {
    setConfirmDialog({
      message: `Are you sure you want to delete file "${file.name}"?`,
      onConfirm: async () => {
        setIsConfirmActionSubmitting(true);
        try {
          await supabase
            .from('resources_buckets')
            .delete()
            .eq('school_id', schoolId)
            .eq('class_id', activeClassId)
            .eq('class_course_id', focusCourse?.id)
            .eq('name', file.name)
            .eq('metadata->>folder', folderName);

          await loadFilesForCourseFolder(folderName);
          await loadCourseFolders();
          notify(`Deleted file "${file.name}"`);
        } catch (error: any) {
          console.error('Failed to delete file:', error);
          notify(`Failed to delete file: ${error?.message || 'Unknown error'}`);
        } finally {
          setIsConfirmActionSubmitting(false);
          setConfirmDialog(null);
        }
      }
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-premium">
      <button
        type="button" onClick={() => setIsCourseResourcesOpen(prev => !prev)}
        className="w-full flex flex-wrap items-center justify-between gap-3 mb-3 group text-left"
      >
        <div className="flex items-center gap-2">
          <i className={`fas fa-chevron-right text-[10px] transition-transform ${isCourseResourcesOpen ? 'rotate-90 text-brand-500' : 'text-slate-400'}`}></i>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-brand-500 transition-colors">Course Folders</p>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-brand-500">{courseFolders.length} Folders</span>
      </button>

      {isCourseResourcesOpen && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input aria-label="Action"
              value={newCourseFolderName}
              onChange={event => setNewCourseFolderName(event.target.value)}
              placeholder="Folder name"
              className="flex-1 min-w-[200px] bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
            />
            <button
              type="button" onClick={() => void createCourseFolder()}
              disabled={isCourseFolderCreating}
              className="px-3 py-2 rounded-xl bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
            >
              {isCourseFolderCreating ? 'Creating...' : 'Create Folder'}
            </button>
          </div>

          {isCourseFoldersLoading ? (
            <p className="text-xs font-semibold text-slate-500">Loading course folders...</p>
          ) : courseFolders.length === 0 ? (
            <p className="text-xs font-semibold text-slate-500">No folders created yet for this course.</p>
          ) : (
            <div className="space-y-2">
              {courseFolders.map(folder => {
                const isOpen = Boolean(openCourseFolders[folder.name]);
                const files = courseFolderFiles[folder.name] || [];
                const inputId = `course-folder-upload-${folder.name}`;

                return (
                  <div key={folder.name} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 p-3">
                      <button
                        type="button" onClick={() => void toggleCourseFolderOpen(folder.name)}
                        className="min-w-0 flex items-center gap-2 text-left"
                      >
                        <i className={`fas fa-chevron-right text-[10px] transition-transform ${isOpen ? 'rotate-90 text-brand-500' : 'text-slate-400'}`}></i>
                        <i className="fas fa-folder text-amber-500 text-xs"></i>
                        <span className="text-xs font-black truncate">{folder.name}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{folder.filesCount}</span>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button" onClick={(e) => { e.stopPropagation(); void deleteCourseFolder(folder.name); }}
                          className="px-2 py-1 rounded-md bg-rose-50 text-rose-500 hover:bg-rose-100 text-[10px] font-black uppercase tracking-widest transition-colors"
                        >
                          Del
                        </button>
                        <button
                          type="button" onClick={() => courseFolderUploadRefs.current[inputId]?.click()}
                          disabled={uploadingCourseFolderName === folder.name}
                          className="px-2.5 py-1.5 rounded-lg bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                        >
                          {uploadingCourseFolderName === folder.name ? 'Uploading...' : 'Add File'}
                        </button>
                      </div>

                      <input aria-label="Action"
                        id={inputId}
                        ref={node => {
                          courseFolderUploadRefs.current[inputId] = node;
                        }}
                        type="file"
                        accept={FOLDER_FILE_ACCEPT}
                        multiple
                        className="hidden"
                        onChange={event => {
                          void uploadFilesToCourseFolder(folder.name, event.target.files);
                          event.target.value = '';
                        }}
                      />
                    </div>

                    {isOpen && (
                      <div className="px-3 pb-3 border-t border-slate-200 dark:border-slate-700 pt-2 space-y-2">
                        {files.length === 0 ? (
                          <p className="text-[11px] font-semibold text-slate-500">No files yet.</p>
                        ) : (
                          files.map(file => (
                            <div
                              key={file.path}
                              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 group"
                            >
                              <button
                                type="button"
                                onClick={() => void downloadFileDirectly(file.url, file.name)}
                                className="flex-1 text-left min-w-0 flex items-center gap-2"
                              >
                                <span className="text-[11px] font-black text-brand-500 truncate hover:underline">{file.name}</span>
                              </button>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                  {file.size > 0 ? `${Math.max(1, Math.round(file.size / 1024))}KB` : 'File'}
                                </span>
                                <button
                                  type="button" onClick={(e) => { e.stopPropagation(); void deleteCourseFile(folder.name, file); }}
                                  className="px-2 py-1 rounded-md bg-rose-50 text-rose-500 hover:bg-rose-100 text-[10px] font-black uppercase transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  Del
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[500] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h4 className="text-lg font-black tracking-tight text-slate-800 dark:text-white">Confirm Action</h4>
            <p className="text-sm font-semibold text-slate-500">{confirmDialog.message}</p>
            <div className="flex gap-2 justify-end">
              <button
                type="button" onClick={() => setConfirmDialog(null)}
                disabled={isConfirmActionSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-widest"
              >
                No
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                disabled={isConfirmActionSubmitting}
                className="px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-black uppercase tracking-widest disabled:opacity-60"
               type="button">
                {isConfirmActionSubmitting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
