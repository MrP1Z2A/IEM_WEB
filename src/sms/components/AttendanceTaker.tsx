import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../src/supabaseClient';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AttendanceTakerProps {
  schoolId: string;
}

type AttendanceStatus = 'P' | 'A' | 'L';

interface StudentRecord {
  id: string;
  name: string;
  avatar?: string;
  status: AttendanceStatus | null;
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; icon: string; bg: string; text: string; ring: string }> = {
  P: { label: 'Present', icon: 'fa-circle-check', bg: 'bg-brand-500', text: 'text-brand-600 dark:text-brand-400', ring: 'ring-brand-500' },
  A: { label: 'Absent',  icon: 'fa-circle-xmark', bg: 'bg-rose-500',    text: 'text-rose-600 dark:text-rose-400',       ring: 'ring-rose-500' },
  L: { label: 'Late',    icon: 'fa-clock',         bg: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',     ring: 'ring-amber-500' },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

// ---------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------

const AttendanceControls: React.FC<{
  classes: any[];
  courses: any[];
  selectedClassId: string;
  handleClassChange: (classId: string) => void;
  selectedCourseId: string;
  setSelectedCourseId: (courseId: string) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  isCalendarOpen: boolean;
  setIsCalendarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  calendarMonth: Date;
  setCalendarMonth: React.Dispatch<React.SetStateAction<Date>>;
  calendarDays: (Date | null)[];
  isSelected: (d: Date) => boolean;
  isToday: (d: Date) => boolean;
}> = ({
  classes, courses, selectedClassId, handleClassChange, selectedCourseId, setSelectedCourseId,
  selectedDate, setSelectedDate, isCalendarOpen, setIsCalendarOpen, calendarMonth, setCalendarMonth,
  calendarDays, isSelected, isToday
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div className="relative">
      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Class</label>
      <div className="relative">
        <select value={selectedClassId} onChange={e => handleClassChange(e.target.value)}
          className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-4 pr-10 text-sm font-semibold text-slate-700 dark:text-white focus:outline-none focus:border-brand-500 transition-all cursor-pointer shadow-sm">
          <option value="">— Select Class —</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
      </div>
    </div>

    <div className="relative">
      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Course</label>
      <div className="relative">
        <select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)}
          disabled={!selectedClassId}
          className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-4 pr-10 text-sm font-semibold text-slate-700 dark:text-white focus:outline-none focus:border-brand-500 transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
          <option value="">— Select Course —</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
      </div>
    </div>

    <div className="relative">
      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Attendance Date</label>
      <button type="button" onClick={() => setIsCalendarOpen(p => !p)}
        className="w-full flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-semibold text-slate-700 dark:text-white focus:outline-none hover:border-brand-500 transition-all shadow-sm">
        <span className="flex items-center gap-3">
          <i className="fas fa-calendar text-brand-500"></i>
          {DAYS[selectedDate.getDay()]}, {MONTHS[selectedDate.getMonth()].slice(0,3)} {selectedDate.getDate()}
        </span>
        <i className={`fas fa-chevron-down text-slate-400 text-xs transition-transform duration-200 ${isCalendarOpen ? 'rotate-180' : ''}`}></i>
      </button>

      {isCalendarOpen && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[24px] shadow-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-4">
            <button aria-label="Action" type="button" onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth()-1, 1))}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-brand-500 hover:text-white transition-all">
              <i className="fas fa-chevron-left text-xs"></i>
            </button>
            <h4 className="text-sm font-black text-slate-700 dark:text-white">
              {MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
            </h4>
            <button aria-label="Action" type="button" onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth()+1, 1))}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-brand-500 hover:text-white transition-all">
              <i className="fas fa-chevron-right text-xs"></i>
            </button>
          </div>
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => <div key={d} className="text-center text-[9px] font-black uppercase tracking-widest text-slate-400">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => (
              <div key={i}>
                {day ? (
                  <button type="button" onClick={() => { setSelectedDate(day); setIsCalendarOpen(false); }}
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
          <button type="button" onClick={() => { setSelectedDate(new Date()); setCalendarMonth(new Date()); setIsCalendarOpen(false); }}
            className="w-full mt-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-brand-500 hover:bg-brand-500/5 rounded-xl transition-all">
            Go to Today
          </button>
        </div>
      )}
    </div>
  </div>
);

const AttendanceStats: React.FC<{ stats: any }> = ({ stats }) => (
  <div className="grid grid-cols-4 gap-3">
    {[
      { key: 'present', label: 'Present', value: stats.present, color: 'text-brand-600 bg-brand-50 border-brand-200 dark:bg-brand-500/10 dark:border-brand-500/20 dark:text-brand-400', icon: 'fa-circle-check' },
      { key: 'absent',  label: 'Absent',  value: stats.absent,  color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400',             icon: 'fa-circle-xmark' },
      { key: 'late',    label: 'Late',    value: stats.late,    color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400',          icon: 'fa-clock' },
      { key: 'unmarked',label: 'Unmarked',value: stats.unmarked, color: 'text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700',                                    icon: 'fa-circle-question' },
    ].map(s => (
      <div key={s.key} className={`flex items-center gap-3 p-4 rounded-[24px] border ${s.color} transition-all`}>
        <i className={`fas ${s.icon} text-lg`}></i>
        <div>
          <p className="text-2xl font-black">{s.value}</p>
          <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{s.label}</p>
        </div>
      </div>
    ))}
  </div>
);

const RollCallList: React.FC<{
  students: StudentRecord[];
  selectedClass: any;
  selectedCourse: any;
  selectedClassId: string;
  selectedCourseId: string;
  isLoadingStudents: boolean;
  markAll: (status: AttendanceStatus) => void;
  unmarkAll: () => void;
  setStatus: (studentId: string, status: AttendanceStatus | null) => void;
  saveAttendance: () => void;
  isSaving: boolean;
  stats: any;
  downloadAttendancePDF: () => void;
}> = ({
  students, selectedClass, selectedCourse, selectedClassId, selectedCourseId, isLoadingStudents,
  markAll, unmarkAll, setStatus, saveAttendance, isSaving, stats, downloadAttendancePDF
}) => (
  <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-premium overflow-hidden">
    <div className="flex items-center justify-between p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800">
      <div className="flex-1">
        <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
          <i className="fas fa-clipboard-list text-brand-500"></i>
          Roll Call
          {selectedClass && <span className="text-[10px] font-bold text-slate-400 ml-1">— {selectedClass.name}{selectedCourse ? ` / ${selectedCourse.name}` : ''}</span>}
        </h3>
        {students.length > 0 && <p className="text-[10px] text-slate-400 mt-0.5">{stats.total} students · click a student to cycle status, or use buttons</p>}
      </div>
      {students.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={downloadAttendancePDF}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm shadow-emerald-500/20">
            <i className="fas fa-file-pdf"></i> Export PDF
          </button>
          <button type="button" onClick={() => markAll('P')}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm shadow-brand-500/20">
            <i className="fas fa-check-double"></i> Mark All Present
          </button>
          <button onClick={unmarkAll}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all" type="button">
            Reset All
          </button>
        </div>
      )}
    </div>

    <div className="divide-y divide-slate-50 dark:divide-slate-800/60 max-h-[600px] overflow-y-auto custom-scrollbar">
      {!selectedClassId ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-30">
          <i className="fas fa-layer-group text-5xl mb-4 text-slate-400"></i>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Select a class to begin</p>
        </div>
      ) : !selectedCourseId ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-30">
          <i className="fas fa-book-open text-5xl mb-4 text-slate-400"></i>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Select a course to begin</p>
        </div>
      ) : isLoadingStudents ? (
        <div className="flex items-center justify-center py-20 gap-3 opacity-40">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-black text-brand-500 uppercase tracking-widest">Loading students…</p>
        </div>
      ) : students.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-30">
          <i className="fas fa-user-graduate text-5xl mb-4 text-slate-400"></i>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No students in this course</p>
        </div>
      ) : students.map((student, idx) => {
        const cfg = student.status ? STATUS_CONFIG[student.status] : null;
        return (
          <div key={student.id}
            className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-all group">
            <span className="text-xs font-black text-slate-300 dark:text-slate-700 w-5 text-right shrink-0">{idx + 1}</span>
            <div className="relative shrink-0">
              {student.avatar
                ? <img src={student.avatar} alt={student.name} className="w-11 h-11 rounded-2xl object-cover" />
                : <div className="w-11 h-11 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500 font-black text-base">{student.name.charAt(0)}</div>}
              {cfg && (
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${cfg.bg} rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900`}>
                  <i className={`fas ${cfg.icon} text-[6px] text-white`}></i>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-black truncate ${cfg ? cfg.text : 'text-slate-700 dark:text-white'}`}>{student.name}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{cfg ? cfg.label : 'Not marked'}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {(['P', 'A', 'L'] as AttendanceStatus[]).map(s => {
                const c = STATUS_CONFIG[s];
                const active = student.status === s;
                return (
                  <button key={s} type="button" onClick={() => setStatus(student.id, active ? null : s)}
                    title={c.label}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black transition-all border ${
                      active
                        ? `${c.bg} text-white border-transparent shadow-md`
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}>
                    <i className={`fas ${c.icon} text-[10px]`}></i>
                    <span className="hidden sm:inline">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>

    {students.length > 0 && (
      <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          {stats.present}P · {stats.absent}A · {stats.late}L · {stats.unmarked} unmarked
        </p>
        <button type="button" onClick={() => void saveAttendance()} disabled={isSaving}
          className="px-6 py-2.5 bg-brand-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all disabled:opacity-50">
          Confirm & Save
        </button>
      </div>
    )}
  </div>
);

// ---------------------------------------------------------
// Main Component
// ---------------------------------------------------------

const AttendanceTaker: React.FC<AttendanceTakerProps> = ({ schoolId }) => {
  const [classes, setClasses] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [students, setStudents] = useState<StudentRecord[]>([]);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success'|'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success'|'error' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const selectedClass = classes.find(c => String(c.id) === selectedClassId);
  const selectedCourse = courses.find(c => String(c.id) === selectedCourseId);

  useEffect(() => {
    if (!supabase || !schoolId) return;
    void supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name')
      .then(({ data }) => setClasses(data || []));
  }, [schoolId]);

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    setSelectedCourseId('');
    setStudents([]);
    if (!classId || !supabase) {
      setCourses([]);
      return;
    }
    void supabase.from('class_courses').select('id, name').eq('class_id', classId).eq('school_id', schoolId).order('name')
      .then(({ data }) => setCourses(data || []));
  };

  useEffect(() => {
    if (!selectedCourseId) { setStudents([]); return; }
    void loadStudentsAndAttendance();
  }, [selectedCourseId, selectedDate]);

  const loadStudentsAndAttendance = async () => {
    if (!supabase || !selectedCourseId) return;
    setIsLoadingStudents(true);
    try {
      const dateStr = fmtDate(selectedDate);

      const { data: assignments } = await supabase
        .from('class_course_students')
        .select('student_id')
        .eq('class_course_id', selectedCourseId);

      const studentIds = (assignments || []).map((a: any) => String(a.student_id));
      if (studentIds.length === 0) { setStudents([]); setIsLoadingStudents(false); return; }

      const { data: studentData } = await supabase
        .from('students')
        .select('id, name, avatar')
        .in('id', studentIds)
        .order('name');

      const { data: attendanceData } = await supabase
        .from('attendance_records')
        .select('student_id, status')
        .eq('context_type', 'subject')
        .eq('context_id', selectedCourseId)
        .eq('attendance_date', dateStr);

      const attendanceMap: Record<string, AttendanceStatus> = {};
      for (const a of (attendanceData || [])) {
        attendanceMap[String(a.student_id)] = a.status as AttendanceStatus;
      }

      setStudents((studentData || []).map((s: any) => ({
        id: String(s.id),
        name: s.name,
        avatar: s.avatar,
        status: attendanceMap[String(s.id)] ?? null,
      })));
    } catch (err) {
      console.error(err);
      showToast('Failed to load students.', 'error');
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const setStatus = (studentId: string, status: AttendanceStatus | null) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status } : s));
  };

  const markAll = (status: AttendanceStatus) => setStudents(prev => prev.map(s => ({ ...s, status })));
  const unmarkAll = () => setStudents(prev => prev.map(s => ({ ...s, status: null })));

  const saveAttendance = async () => {
    if (!supabase || !selectedCourseId) return;
    setIsSaving(true);
    try {
      const dateStr = fmtDate(selectedDate);

      await supabase.from('attendance_records')
        .delete()
        .eq('context_type', 'subject')
        .eq('context_id', selectedCourseId)
        .eq('attendance_date', dateStr);

      const toInsert = students
        .filter(s => s.status !== null)
        .map(s => ({
          student_id: s.id,
          status: s.status,
          context_type: 'subject',
          context_id: selectedCourseId,
          attendance_date: dateStr,
          school_id: schoolId,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('attendance_records').insert(toInsert);
        if (error) throw error;
      }
      showToast(`Attendance saved for ${dateStr}.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to save attendance.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const stats = useMemo(() => ({
    present: students.filter(s => s.status === 'P').length,
    absent:  students.filter(s => s.status === 'A').length,
    late:    students.filter(s => s.status === 'L').length,
    unmarked: students.filter(s => s.status === null).length,
    total: students.length,
  }), [students]);

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

  const downloadAttendancePDF = async () => {
    if (students.length === 0) return;

    try {
      const { data: schoolData } = await supabase
        .from('schools')
        .select('name')
        .eq('id', schoolId)
        .single();
      const schoolName = schoolData?.name || 'School Management System';

      const doc = new jsPDF();

      // Premium Indigo Header Banner
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 38, 'F');

      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(schoolName.toUpperCase(), 14, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(224, 231, 255);
      doc.text('CLASS / COURSE ATTENDANCE REPORT', 14, 28);

      // Metadata Section
      let y = 48;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Report Details', 14, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Class: ${selectedClass?.name || 'N/A'}`, 14, y + 6);
      doc.text(`Course: ${selectedCourse?.name || 'N/A'}`, 14, y + 12);
      doc.text(`Date: ${fmtDate(selectedDate)}`, 14, y + 18);

      const timestamp = new Date().toLocaleString();
      doc.text(`Generated: ${timestamp}`, 135, y + 6);
      doc.text(`Total Students: ${students.length}`, 135, y + 12);

      // Statistics Card/Bar
      y += 24;
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, 182, 16, 'F');
      doc.rect(14, y, 182, 16, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      
      doc.setTextColor(16, 185, 129); // emerald-600
      doc.text(`Present: ${stats.present} (${students.length ? Math.round((stats.present / students.length) * 100) : 0}%)`, 20, y + 10);

      doc.setTextColor(239, 68, 68); // rose-600
      doc.text(`Absent: ${stats.absent} (${students.length ? Math.round((stats.absent / students.length) * 100) : 0}%)`, 65, y + 10);

      doc.setTextColor(245, 158, 11); // amber-600
      doc.text(`Late: ${stats.late} (${students.length ? Math.round((stats.late / students.length) * 100) : 0}%)`, 110, y + 10);

      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Unmarked: ${stats.unmarked}`, 155, y + 10);

      // Render Attendance Table
      const tableRows = students.map((s, idx) => {
        let statusText = 'Unmarked';
        if (s.status === 'P') statusText = 'Present';
        else if (s.status === 'A') statusText = 'Absent';
        else if (s.status === 'L') statusText = 'Late';

        return [
          (idx + 1).toString(),
          s.name || 'N/A',
          statusText
        ];
      });

      autoTable(doc, {
        startY: y + 24,
        head: [['No.', 'Student Name', 'Status']],
        body: tableRows,
        theme: 'striped',
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'left'
        },
        styles: {
          fontSize: 9,
          cellPadding: 5,
          textColor: [15, 23, 42]
        },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' },
          1: { cellWidth: 125 },
          2: { cellWidth: 42, fontStyle: 'bold' }
        },
        didParseCell: function (data) {
          if (data.column.index === 2 && data.section === 'body') {
            const statusVal = data.cell.text[0];
            if (statusVal === 'Present') {
              data.cell.styles.textColor = [16, 185, 129];
            } else if (statusVal === 'Absent') {
              data.cell.styles.textColor = [239, 68, 68];
            } else if (statusVal === 'Late') {
              data.cell.styles.textColor = [245, 158, 11];
            } else {
              data.cell.styles.textColor = [100, 116, 139];
            }
          }
        }
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 280, 196, 280);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('This is an official document generated by the IEM SMS Portal.', 105, 286, { align: 'center' });
      }

      const fileClassName = (selectedClass?.name || 'class').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileCourseName = (selectedCourse?.name || 'course').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      doc.save(`attendance_${fileClassName}_${fileCourseName}_${fmtDate(selectedDate)}.pdf`);
      showToast('Attendance PDF downloaded.', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(`Failed to generate PDF: ${err.message || err}`, 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {notification && (
        <div className={`fixed top-8 right-8 z-[999] px-6 py-4 rounded-[24px] shadow-2xl flex items-center gap-4 text-white font-black text-sm animate-in slide-in-from-top-4 duration-300 ${notification.type === 'error' ? 'bg-rose-500' : 'bg-brand-500'}`}>
          <i className={`fas ${notification.type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check'}`}></i>
          {notification.msg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-slate-800 dark:text-white flex items-center gap-3">
            <i className="fas fa-calendar-check text-brand-500"></i> Attendance
          </h2>
          <p className="text-slate-400 text-sm mt-1">Take roll call for classes and courses</p>
        </div>
        {students.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void downloadAttendancePDF()} disabled={isLoadingStudents || isSaving}
              className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50">
              <i className="fas fa-file-pdf"></i>
              Export PDF
            </button>
            <button type="button" onClick={() => void saveAttendance()} disabled={isSaving}
              className="flex items-center gap-2 px-5 py-3 bg-brand-500 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/25 disabled:opacity-50">
              <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`}></i>
              {isSaving ? 'Saving…' : 'Save Attendance'}
            </button>
          </div>
        )}
      </div>

      <AttendanceControls
        classes={classes}
        courses={courses}
        selectedClassId={selectedClassId}
        handleClassChange={handleClassChange}
        selectedCourseId={selectedCourseId}
        setSelectedCourseId={setSelectedCourseId}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        isCalendarOpen={isCalendarOpen}
        setIsCalendarOpen={setIsCalendarOpen}
        calendarMonth={calendarMonth}
        setCalendarMonth={setCalendarMonth}
        calendarDays={calendarDays}
        isSelected={isSelected}
        isToday={isToday}
      />

      {students.length > 0 && <AttendanceStats stats={stats} />}

      <RollCallList
        students={students}
        selectedClass={selectedClass}
        selectedCourse={selectedCourse}
        selectedClassId={selectedClassId}
        selectedCourseId={selectedCourseId}
        isLoadingStudents={isLoadingStudents}
        markAll={markAll}
        unmarkAll={unmarkAll}
        setStatus={setStatus}
        saveAttendance={saveAttendance}
        isSaving={isSaving}
        stats={stats}
        downloadAttendancePDF={downloadAttendancePDF}
      />
    </div>
  );
};

export default AttendanceTaker;
