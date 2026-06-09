import React, { useState, useEffect } from 'react';
import SMSApp from './sms/App';
import LMSApp from './lms/App';
import ParentApp from './parent/App';
import { supabase } from './sms/supabaseClient';
import { 
  normalizeParentMessagingEmail, 
  getFallbackParentName, 
  buildParentMessagingId, 
  findParentMessagingUserByEmail 
} from './shared/messaging/parentMessaging';
import logoIem from './sms/src/LOGO_IEM.png';
import { Mail, Lock, LogIn, ShieldAlert, Eye, EyeOff } from 'lucide-react';

const APP_MODE_KEY = 'iem_app_mode';

export default function Portal() {
  const [appMode, setAppMode] = useState<'portal' | 'sms' | 'lms' | 'parent' | 'student_service'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(APP_MODE_KEY);
      if (saved === 'sms' || saved === 'lms' || saved === 'parent' || saved === 'student_service') return saved as any;
    }
    return 'portal';
  });

  const [schoolId, setSchoolIdState] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('iem_user');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          return parsed.schoolId || parsed.school_id;
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  });

  const [schoolName, setSchoolName] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('iem_user');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          return parsed.schoolName;
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  });

  // Unified login states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSchoolId = (newId: string | undefined, newName?: string) => {
    setSchoolIdState(newId);
    setSchoolName(newName);
    
    if (typeof window !== 'undefined') {
      if (newId) {
        const raw = window.localStorage.getItem('iem_user');
        let user = {};
        try { if (raw) user = JSON.parse(raw); } catch {}
        window.localStorage.setItem('iem_user', JSON.stringify({ 
          ...user, 
          schoolId: newId, 
          school_id: newId,
          schoolName: newName 
        }));
      } else {
        window.localStorage.removeItem('iem_user');
      }
    }
  };

  useEffect(() => {
    const fetchSchoolName = async (id: string) => {
      try {
        const { data, error } = await supabase
          .from('schools')
          .select('name')
          .eq('id', id)
          .maybeSingle();
        
        if (!error && data?.name) {
          setSchoolName(data.name);
          const raw = window.localStorage.getItem('iem_user');
          if (raw) {
            try {
              const user = JSON.parse(raw);
              window.localStorage.setItem('iem_user', JSON.stringify({ ...user, schoolName: data.name }));
            } catch {}
          }
        }
      } catch (err) {
        console.error('Failed to fetch school name:', err);
      }
    };

    if (schoolId && !schoolName) {
      fetchSchoolName(schoolId);
    }
  }, [schoolId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(APP_MODE_KEY, appMode);
    }
    
    if (appMode === 'lms') {
      document.body.classList.add('lms-mode');
    } else {
      document.body.classList.remove('lms-mode');
    }
  }, [appMode]);

  const handleSwitch = () => {
    setAppMode('portal');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const isParentLogin = !password.trim();

      if (isParentLogin) {
        // Parent Sign In (no password required)
        const normalizedEmail = normalizeParentMessagingEmail(identifier);
        let { data, error: fetchError } = await supabase
          .from('students')
          .select('id, name, parent_name, parent_email, secondary_parent_name, secondary_parent_email, school_id')
          .or(`parent_email.ilike.${normalizedEmail},secondary_parent_email.ilike.${normalizedEmail}`);

        if (fetchError) throw fetchError;

        if (data && data.length > 0) {
          const schoolId = data[0].school_id || '';
          const parentUser = schoolId
            ? findParentMessagingUserByEmail(schoolId, data, normalizedEmail)
            : null;

          const parentData = {
            email: normalizedEmail,
            parentId: parentUser?.id || buildParentMessagingId(schoolId, normalizedEmail),
            parentName: parentUser?.name || getFallbackParentName(normalizedEmail),
            studentIds: data.map(s => s.id),
            studentNames: data.map(s => s.name),
            schoolId,
          };

          localStorage.setItem('iem_parent_session', 'true');
          localStorage.setItem('iem_parent_data', JSON.stringify(parentData));
          
          if (schoolId) {
            updateSchoolId(schoolId, schoolName);
          }

          setAppMode('parent');
        } else {
          throw new Error('No student records found linked to this parent email address.');
        }
      } else {
        // Student/Teacher Sign In (password required)
        // 1. Check students table
        const { data: student, error: studentError } = await supabase
          .from('students')
          .select('id, auth_user_id, name, email, temp_password, school_id')
          .or(`name.eq.${identifier},email.eq.${identifier}`)
          .eq('temp_password', password)
          .maybeSingle();

        if (studentError) throw studentError;

        if (student) {
          const newUser = {
            id: student.id,
            role: 'student',
            email: student.email || student.name,
            name: student.name,
            schoolId: student.school_id,
            studentId: student.id,
            eduLevel: 'Student Portal Access'
          };
          localStorage.setItem('iem_logged_in', 'true');
          localStorage.setItem('iem_user', JSON.stringify(newUser));
          
          if (student.school_id) {
            updateSchoolId(student.school_id, schoolName);
          }

          setAppMode('lms');
          return;
        }

        // 2. Check teachers table
        const { data: teacher, error: teacherError } = await supabase
          .from('teachers')
          .select('id, auth_user_id, name, email, temp_password, school_id')
          .or(`name.eq.${identifier},email.eq.${identifier}`)
          .eq('temp_password', password)
          .maybeSingle();

        if (teacherError) throw teacherError;

        if (teacher) {
          const newUser = {
            id: teacher.id,
            role: 'teacher',
            email: teacher.email || teacher.name,
            name: teacher.name,
            schoolId: teacher.school_id,
            teacherId: teacher.id,
          };
          localStorage.setItem('iem_logged_in', 'true');
          localStorage.setItem('iem_user', JSON.stringify(newUser));

          if (teacher.school_id) {
            updateSchoolId(teacher.school_id, schoolName);
          }

          setAppMode('lms');
          return;
        }

        // 3. Fallback check for parents who typed a password anyway
        const normalizedEmail = normalizeParentMessagingEmail(identifier);
        let { data: parentFallback } = await supabase
          .from('students')
          .select('id, name, parent_name, parent_email, secondary_parent_name, secondary_parent_email, school_id')
          .or(`parent_email.ilike.${normalizedEmail},secondary_parent_email.ilike.${normalizedEmail}`);

        if (parentFallback && parentFallback.length > 0) {
          const schoolId = parentFallback[0].school_id || '';
          const parentUser = schoolId
            ? findParentMessagingUserByEmail(schoolId, parentFallback, normalizedEmail)
            : null;

          const parentData = {
            email: normalizedEmail,
            parentId: parentUser?.id || buildParentMessagingId(schoolId, normalizedEmail),
            parentName: parentUser?.name || getFallbackParentName(normalizedEmail),
            studentIds: parentFallback.map(s => s.id),
            studentNames: parentFallback.map(s => s.name),
            schoolId,
          };

          localStorage.setItem('iem_parent_session', 'true');
          localStorage.setItem('iem_parent_data', JSON.stringify(parentData));
          
          if (schoolId) {
            updateSchoolId(schoolId, schoolName);
          }

          setAppMode('parent');
          return;
        }

        throw new Error('Invalid email/name or password.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  if (appMode === 'sms') return <SMSApp onSwitch={handleSwitch} schoolId={schoolId} schoolName={schoolName} onSchoolIdChange={updateSchoolId} />;
  if (appMode === 'lms') return <LMSApp onSwitch={handleSwitch} schoolId={schoolId} schoolName={schoolName} onSchoolIdChange={updateSchoolId} />;
  if (appMode === 'parent') return <ParentApp onSwitch={handleSwitch} schoolId={schoolId} schoolName={schoolName} />;
  if (appMode === 'student_service') return <SMSApp onSwitch={handleSwitch} schoolId={schoolId} schoolName={schoolName} onSchoolIdChange={updateSchoolId} isStudentService />;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white relative overflow-hidden p-6 font-['Segoe_UI',sans-serif]">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] animate-pulse delay-700"></div>

      <div className="z-10 w-full max-w-[450px] px-4 animate-fadeIn">
        
        {/* Brand block */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-20 h-20 bg-white rounded-[24px] flex items-center justify-center p-2 shadow-2xl mb-4 overflow-hidden transform hover:rotate-3 transition-transform">
            <img src={logoIem} alt="IEM Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent uppercase">
            IEM Unified Portal
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.25em] mt-2">
            Multi-Role Gateway
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-2xl p-8 rounded-[32px] shadow-[0_30px_70px_rgba(0,0,0,0.5)] space-y-6">
          <h2 className="text-center text-lg font-black text-white uppercase tracking-wider">
            Sign In To Account
          </h2>

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            {/* Name or Email Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email or Name</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input 
                  type="text" 
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Student, Teacher, or Parent email"
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white/10 transition-all placeholder:text-slate-500 text-sm font-bold font-sans"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input 
                  type={passwordVisible ? 'text' : 'password'} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white/10 transition-all placeholder:text-slate-500 text-sm font-bold"
                />
                <button 
                  type="button" 
                  onClick={() => setPasswordVisible(!passwordVisible)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  {passwordVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-xs font-bold animate-fadeIn">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black uppercase rounded-2xl shadow-xl shadow-emerald-500/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wider transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Access Platform
                </>
              )}
            </button>
          </form>

          {/* Admin bypass */}
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink-0 mx-4 text-slate-500 text-[10px] font-black uppercase tracking-widest">Administrative Control</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          <button
            type="button"
            onClick={() => setAppMode('sms')}
            className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white font-black uppercase rounded-2xl border border-white/10 transition-all text-xs tracking-wider transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
          >
            🏫 Go to SMS Admin Login
          </button>
        </div>
      </div>

      <div className="absolute bottom-8 text-[10px] text-slate-600 font-black uppercase tracking-[0.4em] z-10">
        Unified Ecosystem v2.5 • Decentralized Intelligence
      </div>
    </div>
  );
}
