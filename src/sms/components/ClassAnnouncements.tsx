import React, { useEffect, useMemo, useReducer } from 'react';
import { supabase } from '../supabaseClient';

type AnnouncementItem = {
  id: string;
  title: string;
  message: string;
  notice_date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  attachment_url: string | null;
  class_id: string | null;
  class_course_id: string | null;
  created_at: string;
};

type ClassItem = {
  id: string;
  name: string;
};

type CourseItem = {
  id: string;
  name: string;
  class_id: string;
};

const getTodayIso = () => new Date().toISOString().slice(0, 10);
const priorityOptions: Array<AnnouncementItem['priority']> = ['low', 'medium', 'high', 'urgent'];

// Reducer Definitions

// 1. Form state reducer
type FormState = {
  title: string;
  message: string;
  noticeDate: string;
  priority: AnnouncementItem['priority'];
  targetClassId: string;
  targetCourseId: string;
  selectedFile: File | null;
};

type FormAction =
  | { type: 'SET_FIELD'; field: keyof FormState; value: any }
  | { type: 'RESET_FORM' };

const initialFormState = (): FormState => ({
  title: '',
  message: '',
  noticeDate: getTodayIso(),
  priority: 'medium',
  targetClassId: '',
  targetCourseId: '',
  selectedFile: null,
});

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'RESET_FORM':
      return initialFormState();
    default:
      return state;
  }
}

// 2. UI/status state reducer
type UIState = {
  isLoading: boolean;
  isSaving: boolean;
  deletingId: string | null;
  status: string | null;
  error: string | null;
};

type UIAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS' }
  | { type: 'FETCH_FAILURE'; error: string }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; status: string }
  | { type: 'SAVE_FAILURE'; error: string }
  | { type: 'DELETE_START'; id: string }
  | { type: 'DELETE_SUCCESS'; status: string }
  | { type: 'DELETE_FAILURE'; error: string }
  | { type: 'CLEAR_STATUS' };

const initialUIState: UIState = {
  isLoading: true,
  isSaving: false,
  deletingId: null,
  status: null,
  error: null,
};

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, isLoading: true, error: null, status: null };
    case 'FETCH_SUCCESS':
      return { ...state, isLoading: false };
    case 'FETCH_FAILURE':
      return { ...state, isLoading: false, error: action.error };
    case 'SAVE_START':
      return { ...state, isSaving: true, error: null, status: null };
    case 'SAVE_SUCCESS':
      return { ...state, isSaving: false, status: action.status };
    case 'SAVE_FAILURE':
      return { ...state, isSaving: false, error: action.error };
    case 'DELETE_START':
      return { ...state, deletingId: action.id, error: null, status: null };
    case 'DELETE_SUCCESS':
      return { ...state, deletingId: null, status: action.status };
    case 'DELETE_FAILURE':
      return { ...state, deletingId: null, error: action.error };
    case 'CLEAR_STATUS':
      return { ...state, status: null, error: null };
    default:
      return state;
  }
}

// 3. Data and filter state reducer
type DataState = {
  announcements: AnnouncementItem[];
  classes: ClassItem[];
  courses: CourseItem[];
  filterClassId: string;
  filterPriority: 'all' | AnnouncementItem['priority'];
};

type DataAction =
  | { type: 'SET_DATA'; announcements: AnnouncementItem[]; classes: ClassItem[]; courses: CourseItem[] }
  | { type: 'REMOVE_ANNOUNCEMENT'; id: string }
  | { type: 'SET_FILTER_CLASS'; classId: string }
  | { type: 'SET_FILTER_PRIORITY'; priority: 'all' | AnnouncementItem['priority'] };

const initialDataState: DataState = {
  announcements: [],
  classes: [],
  courses: [],
  filterClassId: 'all',
  filterPriority: 'all',
};

function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case 'SET_DATA':
      return { ...state, announcements: action.announcements, classes: action.classes, courses: action.courses };
    case 'REMOVE_ANNOUNCEMENT':
      return { ...state, announcements: state.announcements.filter(a => a.id !== action.id) };
    case 'SET_FILTER_CLASS':
      return { ...state, filterClassId: action.classId };
    case 'SET_FILTER_PRIORITY':
      return { ...state, filterPriority: action.priority };
    default:
      return state;
  }
}

// Main Component
export default function ClassAnnouncements({ schoolId }: { schoolId: string | undefined }) {
  const [formState, dispatchForm] = useReducer(formReducer, undefined, initialFormState);
  const [uiState, dispatchUI] = useReducer(uiReducer, initialUIState);
  const [dataState, dispatchData] = useReducer(dataReducer, initialDataState);

  const { title, message, noticeDate, priority, targetClassId, targetCourseId, selectedFile } = formState;
  const { isLoading, isSaving, deletingId, status, error } = uiState;
  const { announcements, classes, courses, filterClassId, filterPriority } = dataState;

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(ann => {
      const classPass = filterClassId === 'all' || ann.class_id === filterClassId;
      const priorityPass = filterPriority === 'all' || ann.priority === filterPriority;
      return classPass && priorityPass;
    });
  }, [announcements, filterClassId, filterPriority]);

  const loadData = async () => {
    if (!schoolId) return;
    dispatchUI({ type: 'FETCH_START' });
    try {
      // Fetch classes
      const { data: classData } = await supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name');
      // Fetch courses
      const { data: courseData } = await supabase.from('class_courses').select('id, name, class_id').eq('school_id', schoolId).order('name');
      // Fetch announcements
      const { data: annData } = await supabase
        .from('class_announcements')
        .select('*')
        .eq('school_id', schoolId)
        .order('notice_date', { ascending: false });
      
      dispatchData({
        type: 'SET_DATA',
        classes: classData || [],
        courses: courseData || [],
        announcements: annData || [],
      });
      dispatchUI({ type: 'FETCH_SUCCESS' });
    } catch (err: any) {
      dispatchUI({ type: 'FETCH_FAILURE', error: err.message });
    }
  };

  useEffect(() => {
    void loadData();
  }, [schoolId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message || !schoolId) return;
    dispatchUI({ type: 'SAVE_START' });

    try {
      let attachment_url = null;
      if (selectedFile) {
        const fileName = `announcements/${Date.now()}_${selectedFile.name}`;
        const { error: uploadError } = await supabase.storage.from('notice_files').upload(fileName, selectedFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('notice_files').getPublicUrl(fileName);
        attachment_url = publicUrl;
      }

      const { error: saveError } = await supabase.from('class_announcements').insert([{
        school_id: schoolId,
        title,
        message,
        notice_date: noticeDate,
        priority,
        class_id: targetClassId || null,
        class_course_id: targetCourseId || null,
        attachment_url
      }]);

      if (saveError) throw saveError;

      dispatchUI({ type: 'SAVE_SUCCESS', status: 'Announcement published successfully.' });
      dispatchForm({ type: 'RESET_FORM' });
      void loadData();
    } catch (err: any) {
      dispatchUI({ type: 'SAVE_FAILURE', error: err.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    dispatchUI({ type: 'DELETE_START', id });
    try {
      const { error: delError } = await supabase.from('class_announcements').delete().eq('id', id);
      if (delError) throw delError;
      dispatchData({ type: 'REMOVE_ANNOUNCEMENT', id });
      dispatchUI({ type: 'DELETE_SUCCESS', status: 'Announcement deleted.' });
    } catch (err: any) {
      dispatchUI({ type: 'DELETE_FAILURE', error: err.message });
    }
  };

  const filteredCourses = useMemo(() => {
    if (!targetClassId) return courses;
    return courses.filter(c => c.class_id === targetClassId);
  }, [courses, targetClassId]);

  const stats = useMemo(() => {
    const total = announcements.length;
    const urgent = announcements.filter(a => a.priority === 'urgent').length;
    const high = announcements.filter(a => a.priority === 'high').length;
    const targeted = announcements.filter(a => a.class_id || a.class_course_id).length;
    return { total, urgent, high, targeted };
  }, [announcements]);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      <div className="bg-gradient-to-r from-indigo-900 via-blue-800 to-brand-700 rounded-[40px] p-6 sm:p-8 lg:p-10 text-white shadow-premium relative overflow-hidden group">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>
        <div className="relative z-10">
          <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-brand-200">Targeted Notification</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter mt-2">Class Announcements</h2>
          <p className="text-slate-200 mt-3 text-sm sm:text-base max-w-2xl">Publish and manage notices specifically targeted at certain classes or courses. Reach your students with precision.</p>
        </div>
      </div>

      <StatsCards stats={stats} />

      {(error || status) && (
        <div className="space-y-2">
          {error && <div className="text-sm font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3 flex items-center gap-3"><i className="fas fa-circle-exclamation"></i>{error}</div>}
          {status && <div className="text-sm font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded-2xl px-4 py-3 flex items-center gap-3"><i className="fas fa-check-circle"></i>{status}</div>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <AnnouncementForm
          formState={formState}
          classes={classes}
          filteredCourses={filteredCourses}
          isSaving={isSaving}
          dispatchForm={dispatchForm}
          onSubmit={handleCreate}
        />

        <AnnouncementHistory
          isLoading={isLoading}
          filteredAnnouncements={filteredAnnouncements}
          classes={classes}
          courses={courses}
          filterClassId={filterClassId}
          filterPriority={filterPriority}
          deletingId={deletingId}
          dispatchData={dispatchData}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}

// Subcomponents

interface StatsCardsProps {
  stats: {
    total: number;
    urgent: number;
    high: number;
    targeted: number;
  };
}

function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    { label: 'Total Internal', value: stats.total, icon: 'fa-bullhorn', color: 'bg-brand-500' },
    { label: 'Urgent Alert', value: stats.urgent, icon: 'fa-bolt', color: 'bg-rose-500' },
    { label: 'High Priority', value: stats.high, icon: 'fa-triangle-exclamation', color: 'bg-amber-500' },
    { label: 'Targeted Scopes', value: stats.targeted, icon: 'fa-crosshairs', color: 'bg-brand-500' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((s, i) => (
        <div key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-[32px] shadow-sm flex items-center gap-4 group hover:border-brand-500/30 transition-all">
          <div className={`w-12 h-12 rounded-2xl ${s.color} text-white flex items-center justify-center text-lg shadow-lg group-hover:scale-110 transition-transform`}>
            <i className={`fas ${s.icon}`}></i>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
            <p className="text-xl font-black">{s.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

interface AnnouncementFormProps {
  formState: FormState;
  classes: ClassItem[];
  filteredCourses: CourseItem[];
  isSaving: boolean;
  dispatchForm: React.Dispatch<FormAction>;
  onSubmit: (e: React.FormEvent) => void;
}

function AnnouncementForm({
  formState,
  classes,
  filteredCourses,
  isSaving,
  dispatchForm,
  onSubmit,
}: AnnouncementFormProps) {
  const { title, message, noticeDate, priority, targetClassId, targetCourseId, selectedFile } = formState;

  return (
    <form onSubmit={onSubmit} className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 sm:p-8 shadow-premium space-y-5 h-fit sticky top-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center text-sm"><i className="fas fa-plus"></i></div>
        <h3 className="text-lg font-black tracking-tight">Create New</h3>
      </div>

      <label className="space-y-2 block">
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Title</span>
        <input
          value={title}
          required
          onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'title', value: e.target.value })}
          placeholder="e.g. Physics Lab Session"
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:border-brand-500 focus:ring-4 focus:ring-brand-500/5 transition-all outline-none"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="space-y-2 block">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Date</span>
          <input
            type="date"
            value={noticeDate}
            onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'noticeDate', value: e.target.value })}
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:border-brand-500 focus:ring-4 focus:ring-brand-500/5 transition-all outline-none"
          />
        </label>
        <label className="space-y-2 block">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Priority</span>
          <select
            value={priority}
            onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'priority', value: e.target.value as any })}
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:border-brand-500 transition-all outline-none"
          >
            {priorityOptions.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
        </label>
      </div>

      <label className="space-y-2 block">
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Target Class</span>
        <select
          value={targetClassId}
          onChange={(e) => {
            dispatchForm({ type: 'SET_FIELD', field: 'targetClassId', value: e.target.value });
            dispatchForm({ type: 'SET_FIELD', field: 'targetCourseId', value: '' });
          }}
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:border-brand-500 transition-all outline-none"
        >
          <option value="">Global (All Classes)</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      <label className="space-y-2 block">
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Target Course</span>
        <select
          value={targetCourseId}
          onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'targetCourseId', value: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:border-brand-500 transition-all outline-none"
        >
          <option value="">Global (All Courses)</option>
          {filteredCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      <label className="space-y-2 block">
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Attachment</span>
        <div className="relative">
          <input
            type="file"
            onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'selectedFile', value: e.target.files?.[0] || null })}
            className="w-full opacity-0 absolute inset-0 cursor-pointer z-10"
          />
          <div className="w-full rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 px-4 py-4 text-center group-hover:border-brand-500 transition-all">
            <p className="text-xs font-bold text-slate-400">{selectedFile ? selectedFile.name : 'Click to upload files'}</p>
          </div>
        </div>
      </label>

      <label className="space-y-2 block">
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Message</span>
        <textarea
          value={message}
          required
          onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'message', value: e.target.value })}
          placeholder="Write announcement details here..."
          className="w-full h-32 resize-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:border-brand-500 outline-none transition-all"
        />
      </label>

      <button
        type="submit"
        disabled={isSaving}
        className="w-full rounded-2xl bg-brand-500 hover:bg-brand-600 text-white py-4 text-xs font-black uppercase tracking-widest disabled:opacity-60 transition-all shadow-lg shadow-brand-500/20 active:scale-[0.98]"
      >
        {isSaving ? 'Publishing...' : 'Publish Announcement'}
      </button>
    </form>
  );
}

interface AnnouncementHistoryProps {
  isLoading: boolean;
  filteredAnnouncements: AnnouncementItem[];
  classes: ClassItem[];
  courses: CourseItem[];
  filterClassId: string;
  filterPriority: string;
  deletingId: string | null;
  dispatchData: React.Dispatch<DataAction>;
  onDelete: (id: string) => void;
}

function AnnouncementHistory({
  isLoading,
  filteredAnnouncements,
  classes,
  courses,
  filterClassId,
  filterPriority,
  deletingId,
  dispatchData,
  onDelete,
}: AnnouncementHistoryProps) {
  return (
    <div className="lg:col-span-2 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-6 py-4 rounded-3xl shadow-sm">
        <h3 className="text-lg font-black tracking-tight">Recent History</h3>
        <div className="flex gap-2">
          <select
            value={filterClassId}
            onChange={(e) => dispatchData({ type: 'SET_FILTER_CLASS', classId: e.target.value })}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest"
          >
            <option value="all">ALL CLASSES</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => dispatchData({ type: 'SET_FILTER_PRIORITY', priority: e.target.value as any })}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest"
          >
            <option value="all">ALL PRIORITY</option>
            {priorityOptions.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-50 dark:bg-slate-950 animate-pulse h-40 rounded-[32px]"></div>
          ))}
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[40px] p-16 text-center border border-slate-100 dark:border-slate-800 shadow-premium group">
          <div className="w-24 h-24 bg-brand-500/10 text-brand-500 rounded-full flex items-center justify-center mx-auto mb-8 text-4xl group-hover:scale-110 transition-transform"><i className="fas fa-satellite-dish"></i></div>
          <h4 className="text-2xl font-black tracking-tight mb-2">No active broadcasts</h4>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] max-w-xs mx-auto">Create your first targeted announcement using the panel on the left.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAnnouncements.map(ann => (
            <div key={ann.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 lg:p-8 shadow-premium hover:border-brand-500/50 transition-all group relative overflow-hidden">
              {ann.priority === 'urgent' && <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-3xl -mr-16 -mt-16"></div>}
              
              <div className="flex justify-between items-start gap-4 relative z-10">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-500"><i className="fas fa-calendar-day"></i>{ann.notice_date}</div>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      ann.priority === 'urgent' ? 'bg-rose-100 text-rose-600' :
                      ann.priority === 'high' ? 'bg-amber-100 text-amber-600' :
                      ann.priority === 'medium' ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-600'
                    }`}>{ann.priority}</span>
                    {(ann.class_id || ann.class_course_id) && (
                      <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest"><i className="fas fa-crosshairs mr-1"></i>Targeted</span>
                    )}
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">{ann.title}</h4>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                      <span className="text-brand-500">CLASS:</span>
                      {classes.find(c => c.id === ann.class_id)?.name || 'ALL INSTITUTION'}
                    </div>
                    {ann.class_course_id && (
                      <>
                        <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                          <span className="text-brand-500">SUBJECT:</span>
                          {courses.find(c => c.id === ann.class_course_id)?.name || 'N/A'}
                        </div>
                      </>
                    )}
                  </div>
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl font-medium">{ann.message}</p>
                  
                  {ann.attachment_url && (
                    <div className="pt-4">
                      <a href={ann.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-5 py-3 rounded-2xl text-[10px] font-black text-brand-500 uppercase tracking-widest hover:bg-brand-500 hover:text-white transition-all">
                        <i className="fas fa-paperclip"></i> View Attached Resource
                      </a>
                    </div>
                  )}
                </div>
                
                <button aria-label="Action" 
                  type="button" onClick={() => onDelete(ann.id)}
                  disabled={deletingId === ann.id}
                  className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center text-sm shadow-sm group-hover:scale-100 scale-90 opacity-0 group-hover:opacity-100"
                >
                  <i className="fas fa-trash-can"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
