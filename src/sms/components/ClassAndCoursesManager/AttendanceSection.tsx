import React from 'react';
import { supabase } from '../../supabaseClient';
import { getCurrentTenantContext, withSchoolId } from '../../services/tenantService';
import { Student } from '../../types';
import {
  AttendanceContextType,
  AttendanceStatus,
  AttendanceStudent,
  LightweightSubject,
  ClassRow
} from './useClassAndCoursesManager';

interface AttendanceSectionProps {
  classes: ClassRow[];
  students: Student[];
  allStudents?: Student[];
  subjects: LightweightSubject[];
  contextType: AttendanceContextType;
  setContextType: (type: AttendanceContextType) => void;
  selectedAttendanceContextId: string;
  setSelectedAttendanceContextId: (id: string) => void;
  attendanceDate: string;
  setAttendanceDate: (date: string) => void;
  safeNotify: (msg: string) => void;
  selectedClassId: string | null;
  setSelectedAttendanceContextIdStateOnly: (id: string) => void;
}

const normalizeAttendanceStatus = (value: unknown): AttendanceStatus | null => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === 'P' || normalized === 'PRESENT') return 'P';
  if (normalized === 'A' || normalized === 'ABSENT') return 'A';
  if (normalized === 'L' || normalized === 'LATE' || normalized === 'LEAVE') return 'L';
  return null;
};

import { useAttendanceSection } from './useAttendanceSection';

export const AttendanceSection: React.FC<AttendanceSectionProps> = (props) => {
  const hub = useAttendanceSection(props);
  const { attendanceMap, setAttendanceMap, isAttendanceLoading, setIsAttendanceLoading, isAttendanceSaving, setIsAttendanceSaving, deletingAttendanceStudentId, setDeletingAttendanceStudentId, linkedAttendanceStudents, setLinkedAttendanceStudents, isLinkedAttendanceStudentsLoading, setIsLinkedAttendanceStudentsLoading, activeContextList, effectiveAttendanceContextId, loadLinkedAttendanceStudents, fallbackAttendanceStudents, activeAttendanceStudents, loadAttendance, saveSingleAttendance, markAllPresent, removeAttendanceStudent } = hub;

  const { classes, subjects, contextType, setContextType, selectedAttendanceContextId, setSelectedAttendanceContextId, attendanceDate, setAttendanceDate } = props;

  return (
    <section className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-black tracking-tight">Class Management</h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Integrated attendance section (class/subject).
        </p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={contextType}
            onChange={(e) => setContextType(e.target.value as AttendanceContextType)}
            className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
          >
            <option value="class">Class Attendance</option>
            <option value="subject">Subject Attendance</option>
          </select>

          <select
            value={effectiveAttendanceContextId}
            onChange={(e) => setSelectedAttendanceContextId(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none md:col-span-2"
          >
            {!activeContextList.length && <option value="">No options available</option>}
            {activeContextList.map((item: any) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <input aria-label="Action"
            type="date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadAttendance()}
            disabled={isAttendanceLoading || isAttendanceSaving || !effectiveAttendanceContextId}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${
              isAttendanceLoading || isAttendanceSaving || !effectiveAttendanceContextId
                ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
            }`}
          >
            {isAttendanceLoading ? 'Loading...' : 'Reload'}
          </button>
          <button
            type="button"
            onClick={() => void markAllPresent()}
            disabled={isAttendanceLoading || isAttendanceSaving || activeAttendanceStudents.length === 0}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${
              isAttendanceLoading || isAttendanceSaving || activeAttendanceStudents.length === 0
                ? 'bg-brand-200 text-brand-700 cursor-not-allowed'
                : 'bg-brand-500 text-white'
            }`}
          >
            {isAttendanceSaving ? 'Saving...' : 'Mark All Present'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-black">Students ({activeAttendanceStudents.length})</h3>
          <span className="text-[11px] font-bold text-slate-500">P = Present, A = Absent, L = Leave</span>
        </div>

        {isLinkedAttendanceStudentsLoading ? (
          <p className="p-6 text-sm text-slate-500">Loading students from class_course_students...</p>
        ) : activeAttendanceStudents.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No students available for this context.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {activeAttendanceStudents.map((student: any) => {
              const currentStatus = attendanceMap[String(student.id)] || '-';
              return (
                <li
                  key={student.id}
                  className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{student.name}</p>
                    <p className="text-xs text-slate-500">{student.email || student.id}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 mr-1">Current: {currentStatus}</span>
                    {(['P', 'A', 'L'] as AttendanceStatus[]).map(status => {
                      const active = currentStatus === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => void saveSingleAttendance(String(student.id), status)}
                          disabled={isAttendanceSaving || isAttendanceLoading}
                          className={`w-9 h-9 rounded-lg text-xs font-black ${
                            active
                              ? 'bg-brand-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                    <button aria-label="Action"
                      type="button"
                      onClick={() => void removeAttendanceStudent(String(student.id))}
                      disabled={deletingAttendanceStudentId === String(student.id) || isAttendanceSaving || isAttendanceLoading}
                      className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
                        deletingAttendanceStudentId === String(student.id)
                          ? 'text-slate-300 border-slate-200 cursor-not-allowed'
                          : 'text-slate-400 border-slate-300 hover:text-rose-500 hover:border-rose-300'
                      }`}
                      title="Delete from Supabase"
                    >
                      <i className="fas fa-trash text-xs"></i>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};
