import React from 'react';
import { Student } from '../types';
import { supabase } from '../supabaseClient';

/**
 * StudentDirectory Component
 * 
 * Displays a searchable/filterable list of all students in the system.
 * Includes administrative controls for editing, deleting, and managing permissions.
 */

interface StudentDirectoryProps {
  students: Student[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  openPermissions: (student: Student) => void;
  openEditModal: (type: string, data: any) => void;
  requestStudentEditWithPassword: (student: Student) => void;
  verifyAdminPassword: (password: string) => Promise<boolean>;
  deleteEntity: (id: string, type: string) => void;
}

const StudentDirectory: React.FC<StudentDirectoryProps> = ({
  students,
  selectedDate,
  setSelectedDate,
  openPermissions,
  openEditModal,
  requestStudentEditWithPassword,
  verifyAdminPassword,
  deleteEntity
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedStudent, setSelectedStudent] = React.useState<Student | null>(null);
  const [isTempPasswordVisible, setIsTempPasswordVisible] = React.useState(false);
  const [tempPasswordAuthDialogOpen, setTempPasswordAuthDialogOpen] = React.useState(false);
  const [tempPasswordAuthInput, setTempPasswordAuthInput] = React.useState('');
  const [tempPasswordAuthError, setTempPasswordAuthError] = React.useState<string | null>(null);
  const [isTempPasswordAuthSubmitting, setIsTempPasswordAuthSubmitting] = React.useState(false);

  const hiddenStudentInfoKeys = new Set([
    'temp_password',
    'temp_password_created_at',
    'avatar',
    'avatar_url',
    'profile_image_url',
    'image_url',
    'auth_user_id',
    'permissions',
    'courseAttendance',
    'attendanceRate',
    'securityStatus',
    'type',
  ]);

  const filteredStudents = students.filter(student => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    return (
      student.name.toLowerCase().includes(q) ||
      String(student.id).toLowerCase().includes(q) ||
      student.email.toLowerCase().includes(q)
    );
  });

  const renderDetailValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  };

  const resolveProfileImageUrl = (student: Student) => {
    const candidate = [
      (student as any).avatar,
      (student as any).avatar_url,
      (student as any).profile_image_url,
      (student as any).image_url,
    ].find(value => typeof value === 'string' && value.trim().length > 0) as string | undefined;

    if (!candidate) return '';
    if (/^(https?:|data:|blob:)/i.test(candidate)) return candidate;

    const cleanedPath = candidate.replace(/^\/+/, '');
    const { data } = supabase.storage.from('student_profile').getPublicUrl(cleanedPath);
    return data?.publicUrl || '';
  };

  React.useEffect(() => {
    setIsTempPasswordVisible(false);
    setTempPasswordAuthDialogOpen(false);
    setTempPasswordAuthInput('');
    setTempPasswordAuthError(null);
    setIsTempPasswordAuthSubmitting(false);
  }, [selectedStudent?.id]);

  const unlockTempPassword = async () => {
    if (!tempPasswordAuthInput.trim()) {
      setTempPasswordAuthError('Admin password is required.');
      return;
    }

    setIsTempPasswordAuthSubmitting(true);
    setTempPasswordAuthError(null);

    try {
      const ok = await verifyAdminPassword(tempPasswordAuthInput);
      if (!ok) {
        setTempPasswordAuthError('Invalid admin password.');
        return;
      }

      setIsTempPasswordVisible(true);
      setTempPasswordAuthDialogOpen(false);
      setTempPasswordAuthInput('');
      setTempPasswordAuthError(null);
    } finally {
      setIsTempPasswordAuthSubmitting(false);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      {/* Header Section with Title and Filters */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
        <div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Directory</h2>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.3em] mt-3">Identity Management Protocol</p>
        </div>
        
        {/* Filter Pills */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="bg-white dark:bg-slate-900 p-2 rounded-[24px] sm:rounded-[32px] shadow-premium border border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <i className="fas fa-search text-slate-400 px-2"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, id, email"
              className="bg-transparent text-sm font-semibold px-2 py-2 outline-none min-w-[220px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-3 py-2 rounded-[14px] text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>
          <div className="bg-white dark:bg-slate-900 p-2 rounded-[24px] sm:rounded-[32px] shadow-premium border border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border p-2 rounded"
              title="Filter by created date"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="px-3 py-2 rounded-[14px] text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] lg:rounded-[64px] p-3 sm:p-6 shadow-premium border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left">
            <thead className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-50 dark:border-slate-800">
              <tr>
                <th className="px-12 py-10">Identity Block</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {filteredStudents.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-all group">
                  {/* Student Identity Card */}
                  <td className="px-12 py-10">
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex items-center gap-8 min-w-0">
                        {resolveProfileImageUrl(s) ? (
                          <img
                            src={resolveProfileImageUrl(s)}
                            alt={`${s.name} profile`}
                            className="w-16 h-16 rounded-[28px] object-cover border border-slate-200 dark:border-slate-700 shadow-inner group-hover:scale-110 transition-all"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-[28px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-brand-500 shadow-inner group-hover:scale-110 transition-all">
                            {s.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-lg font-black tracking-tight truncate">{s.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase mt-1 truncate">{s.email} • {s.grade}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedStudent(s)}
                          className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-brand-500 flex items-center justify-center flex-shrink-0"
                          title="View student info"
                        >
                          <i className="fas fa-circle-info"></i>
                        </button>
                        <button
                          onClick={() => deleteEntity(s.id, 'student')}
                          className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 flex items-center justify-center flex-shrink-0"
                          title="Delete student"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedStudent && (
        <div className="fixed inset-0 z-[220] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-black tracking-tight">Student Information</h3>
              <button
                onClick={() => setSelectedStudent(null)}
                className="w-10 h-10 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
              {resolveProfileImageUrl(selectedStudent) ? (
                <img
                  src={resolveProfileImageUrl(selectedStudent)}
                  alt={`${selectedStudent.name} profile`}
                  className="w-20 h-20 rounded-2xl object-cover border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-black text-2xl text-brand-500">
                  {selectedStudent.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-lg font-black tracking-tight truncate">{selectedStudent.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{selectedStudent.email}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">ID: {selectedStudent.id}</p>
                <button
                  onClick={() => requestStudentEditWithPassword(selectedStudent)}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest"
                >
                  Change Profile Photo
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(selectedStudent)
                .filter(([key]) => !hiddenStudentInfoKeys.has(key))
                .map(([key, value]) => (
                <div key={key} className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{key}</p>
                  <p className="text-sm font-semibold break-words">{renderDetailValue(value)}</p>
                </div>
              ))}
            </div>

            {'temp_password' in selectedStudent && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">temp_password</p>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold break-words">
                    {isTempPasswordVisible ? String((selectedStudent as any).temp_password || '—') : '••••••••••'}
                  </p>
                  {!isTempPasswordVisible && (
                    <button
                      onClick={() => setTempPasswordAuthDialogOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest"
                    >
                      View
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => requestStudentEditWithPassword(selectedStudent)}
                className="px-4 py-2.5 rounded-xl bg-brand-500 text-white font-bold text-xs uppercase tracking-widest"
              >
                Edit (Admin Password)
              </button>
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {tempPasswordAuthDialogOpen && (
        <div className="fixed inset-0 z-[225] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h3 className="text-lg font-black tracking-tight">Admin Verification</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">Enter admin password to view temp password.</p>

            <input
              type="password"
              value={tempPasswordAuthInput}
              onChange={(e) => setTempPasswordAuthInput(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
              placeholder="Admin password"
            />

            {tempPasswordAuthError && (
              <p className="text-xs font-bold text-rose-500">{tempPasswordAuthError}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  if (isTempPasswordAuthSubmitting) return;
                  setTempPasswordAuthDialogOpen(false);
                  setTempPasswordAuthInput('');
                  setTempPasswordAuthError(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={unlockTempPassword}
                disabled={isTempPasswordAuthSubmitting}
                className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-widest ${isTempPasswordAuthSubmitting ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-500'}`}
              >
                {isTempPasswordAuthSubmitting ? 'Verifying...' : 'Unlock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDirectory;
