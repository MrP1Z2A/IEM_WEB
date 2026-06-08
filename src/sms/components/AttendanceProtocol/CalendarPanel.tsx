import React, { useState, useEffect, useCallback } from 'react';

interface CalendarPanelProps {
  activeClassId: string;
  focusCourse: { id: string; name: string } | null | undefined;
  attendanceDate: string;
  schoolId: string | undefined;
  supabase: any;
  notify: (msg: string) => void;
  selectedClassName?: string;
}

export const CalendarPanel: React.FC<CalendarPanelProps> = ({
  activeClassId,
  focusCourse,
  attendanceDate,
  schoolId,
  supabase,
  notify,
  selectedClassName,
}) => {
  const [isCourseCalendarOpen, setIsCourseCalendarOpen] = useState(true);
  const [isCourseCalendarLoading, setIsCourseCalendarLoading] = useState(false);
  const [courseCalendarEvents, setCourseCalendarEvents] = useState<Array<{
    id: string;
    title: string;
    event_date: string;
    start_time: string;
    end_time: string;
    class_name: string;
    course_name: string | null;
    notes: string | null;
  }>>([]);

  const loadCourseCalendarEvents = useCallback(async () => {
    if (!focusCourse?.id || !activeClassId || !attendanceDate || !schoolId) {
      setCourseCalendarEvents([]);
      setIsCourseCalendarLoading(false);
      return;
    }

    setIsCourseCalendarLoading(true);
    try {
      const { data, error } = await supabase.from('live_calendar_events')
        .select('id, title, event_date, start_time, end_time, class_id, class_name, course_id, course_name, notes')
        .eq('class_id', activeClassId)
        .eq('event_date', attendanceDate)
        .eq('school_id', schoolId)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      const filtered = (data || []).reduce((acc: any[], event: any) => {
        const eventCourseId = event?.course_id ? String(event.course_id) : '';
        const eventCourseName = event?.course_name ? String(event.course_name).toLowerCase() : '';
        if (eventCourseId === String(focusCourse.id) || eventCourseName === String(focusCourse.name || '').toLowerCase()) {
          acc.push({
            id: String(event.id),
            title: String(event.title || ''),
            event_date: String(event.event_date || ''),
            start_time: String(event.start_time || '').slice(0, 5),
            end_time: String(event.end_time || '').slice(0, 5),
            class_name: String(event.class_name || selectedClassName || ''),
            course_name: event.course_name ? String(event.course_name) : null,
            notes: event.notes ? String(event.notes) : null,
          });
        }
        return acc;
      }, []);

      setCourseCalendarEvents(filtered);
    } catch (error: any) {
      console.error('Failed to load course timetable events:', error);
      notify(`Failed to load course timetable: ${error?.message || 'Unknown error'}`);
      setCourseCalendarEvents([]);
    } finally {
      setIsCourseCalendarLoading(false);
    }
  }, [activeClassId, focusCourse, attendanceDate, schoolId, supabase, selectedClassName, notify]);

  useEffect(() => {
    void loadCourseCalendarEvents();
  }, [loadCourseCalendarEvents]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-premium">
      <button
        type="button" onClick={() => setIsCourseCalendarOpen(prev => !prev)}
        title={isCourseCalendarOpen ? 'Click to collapse course timetable calendar' : 'Click to expand course timetable calendar'}
        className="inline-flex items-center gap-3 px-3 py-2 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-black uppercase tracking-[0.18em] text-slate-700 hover:text-brand-500 dark:text-slate-200 dark:hover:text-brand-300 cursor-pointer"
      >
        <span className={`w-8 h-8 rounded-full flex items-center justify-center border ${isCourseCalendarOpen ? 'bg-brand-500 border-brand-400 text-white shadow-lg shadow-brand-500/40' : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-200'}`}>
          <i className={`fas ${isCourseCalendarOpen ? 'fa-chevron-down' : 'fa-chevron-right'} text-sm`}></i>
        </span>
        <span className={`${isCourseCalendarOpen ? 'text-brand-500 dark:text-brand-400' : ''}`}>Course Timetable Calendar</span>
        <span className="text-[10px] sm:text-xs font-bold tracking-normal normal-case text-brand-600 dark:text-brand-300">
          {focusCourse?.name}
        </span>
      </button>

      {isCourseCalendarOpen && (
        <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Calendar Timetable</p>
            <span className="bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-widest text-slate-500">
              {attendanceDate}
            </span>
          </div>

          {isCourseCalendarLoading && (
            <p className="text-xs font-semibold text-slate-500">Loading timetable entries...</p>
          )}

          {!isCourseCalendarLoading && courseCalendarEvents.length === 0 && (
            <p className="text-xs font-semibold text-slate-500">No timetable entries found for this course on this date.</p>
          )}

          {!isCourseCalendarLoading && courseCalendarEvents.length > 0 && (
            <div className="space-y-3">
              {courseCalendarEvents.map((event, index) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3"
                >
                  <p className="text-xs font-black text-brand-500 uppercase tracking-widest">Period {index + 1}</p>
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200 mt-1">{event.title}</p>
                  <p className="text-[11px] font-semibold text-slate-500 mt-1">
                    {event.start_time} - {event.end_time}
                  </p>
                  {event.notes && (
                    <p className="text-[11px] text-slate-500 mt-1">{event.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
