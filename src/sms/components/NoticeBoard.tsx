import React, { useEffect, useMemo, useReducer } from 'react';
import { supabase } from '../supabaseClient';
import { sanitizeObject } from '../../shared/utils/sanitize';
import { getTodayIso, NOTICE_FILES_BUCKET, MAX_NOTICE_FILE_SIZE } from './NoticeBoard/types';
import { noticeBoardReducer } from './NoticeBoard/NoticeBoardReducer';
import PublishNoticeForm from './NoticeBoard/PublishNoticeForm';
import NoticeList from './NoticeBoard/NoticeList';

const extractStoragePath = (rawValue: string | null): string | null => {
  if (!rawValue) return null;
  const candidate = rawValue.trim();
  if (!candidate) return null;
  if (/^https?:\/\//i.test(candidate)) {
    const marker = `/object/public/${NOTICE_FILES_BUCKET}/`;
    const markerIndex = candidate.indexOf(marker);
    if (markerIndex >= 0) {
      const remainder = candidate.slice(markerIndex + marker.length).split('?')[0];
      return decodeURIComponent(remainder);
    }
    return null;
  }
  return candidate.replace(/^\/+/, '') || null;
};

const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');

interface NoticeBoardProps {
  onOpenNotice: (noticeId: string) => void;
  schoolId: string | undefined;
}

export default function NoticeBoard({ onOpenNotice, schoolId }: NoticeBoardProps) {
  const [state, dispatch] = useReducer(noticeBoardReducer, {
    notices: [],
    isLoading: true,
    isSaving: false,
    deletingId: null,
    status: null,
    error: null,
    filterDate: '',
    filterPriority: 'all',
    confirmDialog: null,
    title: '',
    message: '',
    noticeDate: '',
    priority: 'medium',
    selectedFile: null,
  });

  useEffect(() => {
    dispatch({ type: 'SET_FORM_FIELD', field: 'noticeDate', value: getTodayIso() });
  }, []);

  const sortedNotices = useMemo(
    () => [...state.notices].sort((a, b) => {
      if (a.notice_date === b.notice_date) {
        return b.created_at.localeCompare(a.created_at);
      }
      return b.notice_date.localeCompare(a.notice_date);
    }),
    [state.notices]
  );

  const filteredNotices = useMemo(() => {
    return sortedNotices.filter((item) => {
      const datePass = !state.filterDate || item.notice_date === state.filterDate;
      const priorityPass = state.filterPriority === 'all' || item.priority === state.filterPriority;
      return datePass && priorityPass;
    });
  }, [sortedNotices, state.filterDate, state.filterPriority]);

  const loadNotices = async () => {
    if (!schoolId) {
      dispatch({ type: 'SET_NOTICES', payload: [] });
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    const { data, error: loadError } = await supabase
      .from('notice_board')
      .select('id, title, message, notice_date, priority, file_path, file_name, created_at')
      .eq('school_id', schoolId)
      .order('notice_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (loadError) {
      dispatch({ type: 'SET_ERROR', payload: loadError.message || 'Failed to load notices.' });
      dispatch({ type: 'SET_NOTICES', payload: [] });
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }

    const loaded = (data || []).map((row: any) => ({
      id: String(row.id),
      title: String(row.title || ''),
      message: String(row.message || ''),
      notice_date: String(row.notice_date || getTodayIso()),
      priority: ['low', 'medium', 'high', 'urgent'].includes(row.priority) ? row.priority : 'medium',
      file_path: row.file_path ? String(row.file_path) : null,
      file_name: row.file_name ? String(row.file_name) : null,
      created_at: String(row.created_at || new Date().toISOString()),
    }));

    dispatch({ type: 'SET_NOTICES', payload: loaded });
    dispatch({ type: 'SET_LOADING', payload: false });
  };

  useEffect(() => {
    void loadNotices();
  }, [schoolId]);

  const createNotice = async (event: React.FormEvent) => {
    event.preventDefault();
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_STATUS', payload: null });

    if (!state.title.trim()) {
      dispatch({ type: 'SET_ERROR', payload: 'Title is required.' });
      return;
    }

    if (!state.message.trim() && !state.selectedFile) {
      dispatch({ type: 'SET_ERROR', payload: 'Add announcement text or upload a file.' });
      return;
    }

    if (!state.noticeDate) {
      dispatch({ type: 'SET_ERROR', payload: 'Announcement date is required.' });
      return;
    }

    dispatch({ type: 'SET_SAVING', payload: true });

    let filePath: string | null = null;
    let fileName: string | null = null;

    if (state.selectedFile) {
      if (state.selectedFile.size > MAX_NOTICE_FILE_SIZE) {
        dispatch({ type: 'SET_SAVING', payload: false });
        dispatch({ type: 'SET_ERROR', payload: 'File is too large. Max size is 20MB.' });
        return;
      }

      const sanitizedName = sanitizeFileName(state.selectedFile.name || 'notice-file');
      const uploadPath = `notices/${Date.now()}-${sanitizedName}`;

      const uploadResult = await supabase.storage
        .from(NOTICE_FILES_BUCKET)
        .upload(uploadPath, state.selectedFile, {
          upsert: false,
          contentType: state.selectedFile.type || undefined,
        });

      if (uploadResult.error) {
        dispatch({ type: 'SET_SAVING', payload: false });
        dispatch({ type: 'SET_ERROR', payload: uploadResult.error.message || 'Failed to upload file.' });
        return;
      }

      filePath = uploadPath;
      fileName = state.selectedFile.name;
    }

    const payload = sanitizeObject({
      title: state.title.trim(),
      message: state.message.trim(),
      notice_date: state.noticeDate,
      priority: state.priority,
      file_path: filePath,
      file_name: fileName,
      school_id: schoolId
    });

    const { error: saveError } = await supabase.from('notice_board').insert([payload]);

    dispatch({ type: 'SET_SAVING', payload: false });

    if (saveError) {
      if (filePath) {
        await supabase.storage.from(NOTICE_FILES_BUCKET).remove([filePath]);
      }
      dispatch({ type: 'SET_ERROR', payload: saveError.message || 'Failed to create notice.' });
      return;
    }

    dispatch({ type: 'SET_STATUS', payload: 'Notice published.' });
    dispatch({ type: 'RESET_FORM', defaultDate: getTodayIso() });
    await loadNotices();
  };

  const deleteNotice = (id: string) => {
    dispatch({
      type: 'SET_CONFIRM_DIALOG',
      payload: {
        message: 'Delete this notice? This action is irreversible.',
        onConfirm: async () => {
          dispatch({ type: 'SET_CONFIRM_DIALOG', payload: null });
          const targetNotice = state.notices.find((item) => item.id === id) || null;

          dispatch({ type: 'SET_DELETING_ID', payload: id });
          dispatch({ type: 'SET_ERROR', payload: null });
          dispatch({ type: 'SET_STATUS', payload: null });

          const { error: deleteError } = await supabase.from('notice_board').delete().eq('id', id);

          dispatch({ type: 'SET_DELETING_ID', payload: null });

          if (deleteError) {
            dispatch({ type: 'SET_ERROR', payload: deleteError.message || 'Failed to delete notice.' });
            return;
          }

          if (targetNotice?.file_path) {
            const path = extractStoragePath(targetNotice.file_path);
            if (path) {
              await supabase.storage.from(NOTICE_FILES_BUCKET).remove([path]);
            }
          }

          dispatch({ type: 'SET_STATUS', payload: 'Notice deleted.' });
          dispatch({ type: 'DELETE_NOTICE_SUCCESS', id });
        }
      }
    });
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      <div className="bg-gradient-to-r from-indigo-900 via-blue-800 to-brand-700 rounded-[40px] p-6 sm:p-8 lg:p-10 text-white shadow-premium">
        <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-brand-200">Campus Communication</p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter mt-2">Notice Board</h2>
        <p className="text-slate-200 mt-3 text-sm sm:text-base">Publish announcements with date so students and teachers can stay updated.</p>
      </div>

      {(state.error || state.status) && (
        <div className="space-y-2">
          {state.error && <p className="text-sm font-semibold text-rose-600 bg-rose-50 rounded-2xl px-4 py-3">{state.error}</p>}
          {state.status && <p className="text-sm font-semibold text-brand-700 bg-brand-50 rounded-2xl px-4 py-3">{state.status}</p>}
        </div>
      )}

      <PublishNoticeForm state={state} dispatch={dispatch} createNotice={createNotice} />

      <NoticeList
        state={state}
        dispatch={dispatch}
        filteredNotices={filteredNotices}
        sortedNoticesLength={sortedNotices.length}
        onOpenNotice={onOpenNotice}
        deleteNotice={deleteNotice}
      />

      {state.confirmDialog && (
        <div className="fixed inset-0 z-[120] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-700 shadow-2xl p-8 space-y-6">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center text-2xl mx-auto">
              <i className="fas fa-trash-can animate-bounce"></i>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black tracking-tight">Confirm Deletion</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{state.confirmDialog.message}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button" onClick={() => dispatch({ type: 'SET_CONFIRM_DIALOG', payload: null })}
                className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={state.confirmDialog.onConfirm}
                className="flex-1 px-4 py-3 rounded-2xl bg-rose-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 active:scale-95 transition-all"
               type="button">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
