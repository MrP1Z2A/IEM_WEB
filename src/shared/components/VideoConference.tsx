import React, { useState, useEffect } from 'react';

interface Course {
  id: string;
  title: string;
  category?: string;
  description?: string;
  subTeacherName?: string;
  scheduleDescription?: string;
  thumbnail?: string;
}

interface VideoConferenceProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  schoolId?: string;
  courses: Course[];
  isTeacher: boolean;
  assignedCourseIds?: string[];
  supabase?: any;
  classes?: any[];
}

export const VideoConference: React.FC<VideoConferenceProps> = ({
  user,
  schoolId,
  courses,
  isTeacher,
  assignedCourseIds = [],
  supabase,
  classes = []
}) => {
  const [activeMeetings, setActiveMeetings] = useState<any[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [zoomUrl, setZoomUrl] = useState<string>('');
  const [activeMeeting, setActiveMeeting] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load active meeting on mount
  useEffect(() => {
    // Restore session if teacher started a class previously in this browser session
    const savedSession = localStorage.getItem('active_zoom_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        // Verify it still exists in the database
        verifyActiveSession(parsed);
      } catch (e) {
        localStorage.removeItem('active_zoom_session');
      }
    }
  }, [schoolId]);

  // Poll for active meetings every 10 seconds
  useEffect(() => {
    fetchActiveMeetings();
    const interval = setInterval(fetchActiveMeetings, 10000);
    return () => clearInterval(interval);
  }, [schoolId, assignedCourseIds]);

  const verifyActiveSession = async (session: any) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('live_intel')
        .select('id')
        .eq('id', session.meetingId)
        .maybeSingle();

      if (!error && data) {
        setActiveMeeting(session);
      } else {
        localStorage.removeItem('active_zoom_session');
      }
    } catch (e) {
      console.error("Error verifying active session:", e);
    }
  };

  const fetchActiveMeetings = async () => {
    if (!supabase || !schoolId) return;
    setLoadingMeetings(true);
    try {
      const { data, error } = await supabase
        .from('live_intel')
        .select('*')
        .eq('school_id', schoolId)
        .eq('event_type', 'LiveClass')
        .eq('severity', 'Active');

      if (!error && data) {
        const meetings = data.map((item: any) => ({
          meetingId: item.id,
          courseId: item.details?.course_id,
          courseName: item.details?.course_name,
          zoomUrl: item.details?.zoom_url,
          teacherName: item.details?.teacher_name,
          teacherId: item.details?.teacher_id,
          createdAt: item.created_at
        }));

        // Filter active meetings for the current user
        let filtered = meetings;
        if (user.role === 'student') {
          // Students only see classes they are enrolled in
          filtered = meetings.filter((m: any) => assignedCourseIds.includes(m.courseId));
        } else if (user.role === 'teacher') {
          // Teachers only see their own classes in the active listing
          filtered = meetings.filter((m: any) => assignedCourseIds.includes(m.courseId));
        }
        
        setActiveMeetings(filtered);
      }
    } catch (err) {
      console.error("Error fetching active Zoom classes:", err);
    } finally {
      setLoadingMeetings(false);
    }
  };

  const validateZoomUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return false;
    // Basic Zoom URL regex (matches zoom.us/j/ or zoom.us/my/ or zoom.us/s/ etc)
    return /zoom\.us\/(j|my|s)\/\d+/i.test(trimmed) || trimmed.includes('zoom.us');
  };

  const handleStartClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !schoolId) return;
    if (!selectedCourseId) {
      setError("Please select a course to start a class.");
      return;
    }
    if (!zoomUrl || !validateZoomUrl(zoomUrl)) {
      setError("Please enter a valid Zoom meeting link.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const selectedCourseObj = courses.find(c => c.id === selectedCourseId) || classes.find(c => c.id === selectedCourseId);
    const courseName = selectedCourseObj ? (selectedCourseObj.title || selectedCourseObj.name) : 'Unknown Class';

    try {
      const { data, error: dbError } = await supabase
        .from('live_intel')
        .insert([{
          school_id: schoolId,
          event_type: 'LiveClass',
          severity: 'Active',
          details: {
            log: `${user.name} started a live Zoom class for ${courseName}.`,
            course_id: selectedCourseId,
            course_name: courseName,
            zoom_url: zoomUrl.trim(),
            teacher_id: user.id,
            teacher_name: user.name
          }
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      const sessionData = {
        meetingId: data.id,
        courseId: selectedCourseId,
        courseName,
        zoomUrl: zoomUrl.trim()
      };

      localStorage.setItem('active_zoom_session', JSON.stringify(sessionData));
      setActiveMeeting(sessionData);
      setSuccess(`Zoom class successfully started for ${courseName}!`);
      
      // Open Zoom URL to launch native app
      window.open(zoomUrl.trim(), '_blank');

      // Clear input but keep course selection for convenience
      setZoomUrl('');
      fetchActiveMeetings();
    } catch (err: any) {
      console.error("Error starting class:", err);
      setError(err.message || "Failed to start active class in database.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndClass = async (meetingId: string) => {
    if (!supabase) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: dbError } = await supabase
        .from('live_intel')
        .delete()
        .eq('id', meetingId);

      if (dbError) throw dbError;

      localStorage.removeItem('active_zoom_session');
      setActiveMeeting(null);
      setSuccess("Meeting successfully closed.");
      fetchActiveMeetings();
    } catch (err: any) {
      console.error("Error ending class:", err);
      setError(err.message || "Failed to close the live session.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-10 animate-fadeIn text-slate-800 pb-20">
      {/* Header */}
      <header className="flex flex-col justify-between items-start gap-4 border-b border-[#1f4e4a] pb-8">
        <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
          <i className="fa-solid fa-video text-amber-500"></i>
          Live Classroom Portal
        </h2>
        <p className="text-[#4ea59d]/60 font-black text-[10px] uppercase tracking-[0.4em]">
          {isTeacher ? 'Host and manage Zoom meetings' : 'Access active lectures on Zoom'}
        </p>
      </header>

      {/* Notifications */}
      {error && (
        <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-[32px] flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
            <div>
              <p className="font-bold text-sm">Action Failed</p>
              <p className="text-xs opacity-80">{error}</p>
            </div>
          </div>
          <button onClick={() => setError(null)} className="px-6 py-2.5 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all">
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-[32px] flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <i className="fa-solid fa-circle-check text-2xl"></i>
            <div>
              <p className="font-bold text-sm">Success</p>
              <p className="text-xs opacity-80">{success}</p>
            </div>
          </div>
          <button onClick={() => setSuccess(null)} className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Meeting Management / Active Meetings */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Active Meetings List */}
          <section className="bg-white/40 backdrop-blur-2xl p-8 md:p-10 rounded-[40px] border border-white/20 shadow-xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200/50 pb-4">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                Active Lectures
              </h3>
              <button 
                onClick={fetchActiveMeetings} 
                className="text-[10px] font-black text-[#4ea59d] hover:text-[#3d8c85] uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                disabled={loadingMeetings}
              >
                <i className={`fa-solid fa-rotate ${loadingMeetings ? 'fa-spin' : ''}`}></i> Refresh
              </button>
            </div>

            {activeMeetings.length === 0 ? (
              <div className="text-center py-16 px-4 bg-slate-500/5 rounded-3xl border border-dashed border-slate-300/50 flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-200/50 text-slate-400 flex items-center justify-center text-2xl">
                  <i className="fa-solid fa-calendar-xmark"></i>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">No active classes found</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {isTeacher 
                      ? "You haven't started any live Zoom sessions today." 
                      : "Please wait for your lecturer to launch the Zoom session."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activeMeetings.map((meeting) => (
                  <div 
                    key={meeting.meetingId}
                    className="p-6 bg-gradient-to-br from-white/80 to-white/30 backdrop-blur-md border border-white/40 rounded-3xl shadow-lg flex flex-col justify-between space-y-4 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none"></div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-wider">
                          LIVE NOW
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          {new Date(meeting.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h4 className="text-lg font-black text-slate-900 tracking-tight leading-snug">
                        {meeting.courseName}
                      </h4>
                      <p className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                        <i className="fa-solid fa-user-tie text-slate-400"></i> {meeting.teacherName || 'Faculty Host'}
                      </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <a 
                        href={meeting.zoomUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-3 bg-[#2D8CFF] hover:bg-[#1a73e8] text-white text-center rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-up-right-from-square"></i>
                        Launch Zoom
                      </a>
                      {isTeacher && meeting.teacherId === user.id && (
                        <button 
                          onClick={() => handleEndClass(meeting.meetingId)}
                          className="px-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl text-xs transition-colors flex items-center justify-center"
                          title="End Session"
                        >
                          <i className="fa-solid fa-power-off"></i>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Teacher Controls: Launch Class Form */}
          {isTeacher && !activeMeeting && (
            <section className="bg-white/40 backdrop-blur-2xl p-8 md:p-10 rounded-[40px] border border-white/20 shadow-xl space-y-6">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 border-b border-slate-200/50 pb-4">
                <i className="fa-solid fa-plus text-amber-500"></i>
                Launch Live Zoom Session
              </h3>
              
              <form onSubmit={handleStartClass} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Select Course */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                      Select Class / Course
                    </label>
                    <select
                      value={selectedCourseId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedCourseId(id);
                        const selectedClass = classes.find((c: any) => c.id === id);
                        if (selectedClass && selectedClass.zoom_url) {
                          setZoomUrl(selectedClass.zoom_url);
                        }
                      }}
                      className="w-full bg-white/70 border border-slate-200/50 rounded-2xl px-5 py-4 text-slate-900 font-bold focus:outline-none focus:border-[#4ea59d] transition-all"
                      required
                    >
                      <option value="">-- Choose Class/Course --</option>
                      {classes.length > 0 ? (
                        <optgroup label="Classes">
                          {classes.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      <optgroup label="Courses/Subjects">
                        {courses.map(course => (
                          <option key={course.id} value={course.id}>
                            {course.title}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* Zoom Link Input */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                      Zoom Meeting URL
                    </label>
                    <input
                      type="url"
                      value={zoomUrl}
                      onChange={(e) => setZoomUrl(e.target.value)}
                      placeholder="https://zoom.us/j/1234567890?pwd=..."
                      className="w-full bg-white/70 border border-slate-200/50 rounded-2xl px-5 py-4 text-slate-900 font-semibold focus:outline-none focus:border-[#4ea59d] transition-all"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-amber-400 hover:bg-amber-500 text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-400/20 flex items-center justify-center gap-3 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <i className="fa-solid fa-spinner fa-spin text-lg"></i>
                  ) : (
                    <>
                      <i className="fa-solid fa-rocket text-sm"></i>
                      Publish & Start Meeting
                    </>
                  )}
                </button>
              </form>
            </section>
          )}

          {/* Active Meeting Dashboard for Hosting Teacher */}
          {isTeacher && activeMeeting && (
            <section className="bg-gradient-to-br from-[#0a1a19] to-[#050e0d] p-8 md:p-10 rounded-[40px] border border-white/10 shadow-2xl text-slate-100 space-y-6 relative overflow-hidden animate-fadeIn">
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#4ea59d]/5 rounded-bl-full pointer-events-none"></div>
              
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <span className="px-3 py-1 bg-amber-400 text-slate-900 rounded-lg text-[9px] font-black uppercase tracking-wider">
                    HOSTING ACTIVE
                  </span>
                  <h3 className="text-2xl font-black text-white tracking-tight">
                    {activeMeeting.courseName}
                  </h3>
                </div>
                <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 text-lg animate-pulse">
                  <i className="fa-solid fa-signal"></i>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/5 p-6 rounded-3xl border border-white/5 text-sm">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Broadcast State</span>
                  <span className="text-white font-bold flex items-center gap-1.5 mt-1">
                    <span className="h-2.5 w-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                    Online & Active
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Zoom Endpoint</span>
                  <span className="text-white font-bold truncate block mt-1" title={activeMeeting.zoomUrl}>
                    {activeMeeting.zoomUrl}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <a
                  href={activeMeeting.zoomUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-4 bg-[#2D8CFF] hover:bg-[#1a73e8] text-white text-center rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-video"></i> Launch Zoom Client
                </a>
                
                <button
                  onClick={() => handleEndClass(activeMeeting.meetingId)}
                  disabled={isSubmitting}
                  className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-circle-stop"></i> End Class For All
                </button>
              </div>
            </section>
          )}

        </div>

        {/* Right Col: Guidelines / Resources */}
        <div className="space-y-6">
          <section className="bg-white/40 backdrop-blur-2xl p-6 rounded-[36px] border border-white/20 shadow-xl space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <i className="fa-brands fa-zoom text-[#2D8CFF] text-lg"></i> Zoom Instructions
            </h3>
            <div className="space-y-3 pt-2 text-xs text-slate-600 leading-relaxed">
              <p>
                <strong>1. Launch Meeting:</strong> Clicking the join/start button will trigger the browser to open Zoom Workplace. Click <em>"Open Zoom Meetings"</em> when prompted by your browser.
              </p>
              <p>
                <strong>2. Audio & Video:</strong> Ensure your device microphone and camera permissions are allowed in the Zoom app.
              </p>
              <p>
                <strong>3. low-bandwidth advice:</strong> If your connection is unstable in Myanmar, disable incoming video grids inside the Zoom settings menu to conserve bandwidth.
              </p>
            </div>
          </section>

          <section className="bg-white/40 backdrop-blur-2xl p-6 rounded-[36px] border border-white/20 shadow-xl space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <i className="fa-solid fa-circle-question text-slate-500"></i> Support Details
            </h3>
            <div className="space-y-3 pt-2 text-xs text-slate-600">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase tracking-wider">Service Type</span>
                <span className="font-bold text-slate-900 bg-blue-100 text-[#2D8CFF] px-2.5 py-0.5 rounded-lg">Zoom Client</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase tracking-wider">Client Version</span>
                <span className="font-bold text-slate-900">Workplace App</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase tracking-wider">Auto-Sync</span>
                <span className="font-bold text-slate-900">10 Seconds</span>
              </div>
            </div>
          </section>
        </div>

      </div>
    </div>
  );
};
