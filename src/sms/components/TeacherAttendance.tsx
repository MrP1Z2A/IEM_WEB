import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../src/supabaseClient';

interface TeacherAttendanceProps {
  schoolId: string;
}

type AttendanceStatus = 'P' | 'A' | 'L';

interface TeacherRecord {
  id: string;
  name: string;
  avatar?: string;
  status: AttendanceStatus | null;
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; icon: string; bg: string; text: string; ring: string }> = {
  P: { label: 'Present', icon: 'fa-circle-check', bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500' },
  A: { label: 'Absent',  icon: 'fa-circle-xmark', bg: 'bg-rose-500',    text: 'text-rose-600 dark:text-rose-400',       ring: 'ring-rose-500' },
  L: { label: 'Late',    icon: 'fa-clock',         bg: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',     ring: 'ring-amber-500' },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const TeacherAttendance: React.FC<TeacherAttendanceProps> = ({ schoolId }) => {
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success'|'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success'|'error' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const loadAttendance = useCallback(async () => {
    if (!supabase || !schoolId) return;
    setIsLoading(true);
    try {
      const dateStr = fmtDate(selectedDate);

      // Load all teachers for this school
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id, name, avatar')
        .eq('school_id', schoolId)
        .order('name');

      // Get existing attendance for teachers
      const { data: attendanceData } = await supabase
        .from('attendance_records')
        .select('teacher_id, status')
        .eq('context_type', 'teacher')
        .eq('attendance_date', dateStr)
        .eq('school_id', schoolId);

      const attendanceMap: Record<string, AttendanceStatus> = {};
      for (const a of (attendanceData || [])) {
        if (a.teacher_id) attendanceMap[String(a.teacher_id)] = a.status as AttendanceStatus;
      }

      setTeachers((teacherData || []).map((t: any) => ({
        id: String(t.id),
        name: t.name,
        avatar: t.avatar,
        status: attendanceMap[String(t.id)] ?? null,
      })));
    } catch (err) {
      console.error(err);
      showToast('Failed to load records.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, selectedDate, showToast]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const setStatus = (id: string, status: AttendanceStatus | null) => {
    setTeachers(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const markAll = (status: AttendanceStatus) => setTeachers(prev => prev.map(s => ({ ...s, status })));
  const unmarkAll = () => setTeachers(prev => prev.map(s => ({ ...s, status: null })));

  const saveAttendance = async () => {
    if (!supabase || !schoolId) return;
    setIsSaving(true);
    try {
      const dateStr = fmtDate(selectedDate);

      // Delete existing records for teachers on this date
      await supabase.from('attendance_records')
        .delete()
        .eq('context_type', 'teacher')
        .eq('attendance_date', dateStr)
        .eq('school_id', schoolId);

      // Insert new records
      const toInsert = teachers
        .filter(m => m.status !== null)
        .map(m => ({
          teacher_id: m.id,
          status: m.status,
          context_type: 'teacher',
          context_id: 'school_attendance',
          attendance_date: dateStr,
          school_id: schoolId,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('attendance_records').insert(toInsert);
        if (error) throw error;
      }
      showToast(`Teacher attendance saved for ${dateStr}.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to save attendance.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const stats = useMemo(() => ({
    present: teachers.filter(s => s.status === 'P').length,
    absent:  teachers.filter(s => s.status === 'A').length,
    late:    teachers.filter(s => s.status === 'L').length,
    unmarked: teachers.filter(s => s.status === null).length,
    total: teachers.length,
  }), [teachers]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [calendarMonth]);

  const isToday = (d: Date) => fmtDate(d) === fmtDate(new Date());
  const isSelected = (d: Date) => fmtDate(d) === fmtDate(selectedDate);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Toast */}
      {notification && (
        <div className={`fixed top-6 right-6 z-[999] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-white font-black text-sm animate-in slide-in-from-top-2 duration-300 ${notification.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
          <i className={`fas ${notification.type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check'}`}></i>
          {notification.msg}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-slate-800 dark:text-white flex items-center gap-3">
            <i className="fas fa-user-check text-brand-500"></i> Teacher Attendance
          </h2>
          <p className="text-slate-400 text-sm mt-1">Global daily roll call for teaching staff</p>
        </div>
        {teachers.length > 0 && (
          <button onClick={() => void saveAttendance()} disabled={isSaving}
            className="flex items-center gap-2 px-5 py-3 bg-brand-500 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/25 disabled:opacity-50">
            <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`}></i>
            {isSaving ? 'Saving…' : 'Save Attendance'}
          </button>
        )}
      </div>

      {/* Date Selector */}
      <div className="max-w-xs relative">
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Attendance Date</label>
        <button onClick={() => setIsCalendarOpen(p => !p)}
          className="w-full flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-semibold text-slate-700 dark:text-white focus:outline-none hover:border-brand-500 transition-all shadow-sm">
          <span className="flex items-center gap-3">
            <i className="fas fa-calendar text-brand-500"></i>
            {DAYS[selectedDate.getDay()]}, {MONTHS[selectedDate.getMonth()].slice(0,3)} {selectedDate.getDate()}, {selectedDate.getFullYear()}
          </span>
          <i className={`fas fa-chevron-down text-slate-400 text-xs transition-transform duration-200 ${isCalendarOpen ? 'rotate-180' : ''}`}></i>
        </button>

        {isCalendarOpen && (
          <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[20px] shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth()-1, 1))}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-brand-500 hover:text-white transition-all">
                <i className="fas fa-chevron-left text-xs"></i>
              </button>
              <h4 className="text-sm font-black text-slate-700 dark:text-white">
                {MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
              </h4>
              <button onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth()+1, 1))}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-brand-500 hover:text-white transition-all">
                <i className="fas fa-chevron-right text-xs"></i>
              </button>
            </div>
            <div className="grid grid-cols-7 mb-2">
              {DAYS.map(d => <div key={d} className="text-center text-[9px] font-black uppercase tracking-widest text-slate-400">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map((day, i) => (
                <div key={i}>
                  {day ? (
                    <button onClick={() => { setSelectedDate(day); setIsCalendarOpen(false); }}
                      className={`w-full aspect-square flex items-center justify-center rounded-xl text-xs font-bold transition-all
                        ${isSelected(day) ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' :
                          isToday(day) ? 'border-2 border-brand-500 text-brand-500 font-black' :
                          'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                      {day.getDate()}
                    </button>
                  ) : <div />}
                </div>
              ))}
            </div>
            <button onClick={() => { setSelectedDate(new Date()); setCalendarMonth(new Date()); setIsCalendarOpen(false); }}
              className="w-full mt-3 py-2 text-[10px] font-black uppercase tracking-widest text-brand-500 hover:bg-brand-500/5 rounded-xl transition-all">
              Today
            </button>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      {teachers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Present', value: stats.present, color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400', icon: 'fa-circle-check' },
            { label: 'Absent',  value: stats.absent,  color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400',             icon: 'fa-circle-xmark' },
            { label: 'Late',    value: stats.late,    color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400',          icon: 'fa-clock' },
            { label: 'Unmarked',value: stats.unmarked, color: 'text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700',                                    icon: 'fa-circle-question' },
          ].map(s => (
            <div key={s.label} className={`flex items-center gap-3 p-3 rounded-2xl border ${s.color}`}>
              <i className={`fas ${s.icon} text-lg`}></i>
              <div>
                <p className="text-2xl font-black">{s.value}</p>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Teacher List */}
      <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
            <i className="fas fa-users-rectangle text-brand-500"></i>
            Staff List
            <span className="text-[10px] font-bold text-slate-400 ml-1">— {stats.total} total teachers</span>
          </h3>
          <div className="flex gap-2">
            <button onClick={() => markAll('P')} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Mark All Present</button>
            <button onClick={unmarkAll} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Unmark All</button>
          </div>
        </div>

        <div className="divide-y divide-slate-50 dark:divide-slate-800/60 max-h-[600px] overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 gap-3 opacity-40">
              <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-black text-brand-500 uppercase tracking-widest">Syncing Records…</p>
            </div>
          ) : teachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <i className="fas fa-user-slash text-5xl mb-4 text-slate-400"></i>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No teachers registered in system</p>
            </div>
          ) : teachers.map((teacher, idx) => {
            const cfg = teacher.status ? STATUS_CONFIG[teacher.status] : null;
            return (
              <div key={teacher.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-all group">
                <span className="text-xs font-black text-slate-300 dark:text-slate-700 w-5 text-right shrink-0">{idx + 1}</span>
                <div className="relative shrink-0">
                  {teacher.avatar
                    ? <img src={teacher.avatar} alt={teacher.name} className="w-11 h-11 rounded-2xl object-cover" />
                    : <div className="w-11 h-11 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500 font-black text-base">{teacher.name.charAt(0)}</div>}
                  {cfg && (
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${cfg.bg} rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm`}>
                      <i className={`fas ${cfg.icon} text-[6px] text-white`}></i>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-black truncate ${cfg ? cfg.text : 'text-slate-700 dark:text-white'}`}>{teacher.name}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{cfg ? cfg.label : 'Not marked'}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(['P', 'A', 'L'] as AttendanceStatus[]).map(s => {
                    const c = STATUS_CONFIG[s];
                    const active = teacher.status === s;
                    return (
                      <button key={s} onClick={() => setStatus(teacher.id, active ? null : s)}
                        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border ${
                          active ? `${c.bg} text-white border-transparent shadow-md` : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300'
                        }`}>
                        <i className={`fas ${c.icon} text-xs`}></i>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TeacherAttendance;
