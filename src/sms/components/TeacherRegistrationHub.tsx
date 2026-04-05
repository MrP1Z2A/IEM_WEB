import React from 'react';
import { Student } from '../types';

interface TeacherRegistrationHubProps {
  teachers: Student[];
  enrollTeacherAction: () => void;
  batchRegisterTeachers: (file: File) => Promise<void>;
  isBatchRegistering: boolean;
  deleteEntity: (id: string, type: string) => void;
  schoolId: string | undefined;
}

const TeacherRegistrationHub: React.FC<TeacherRegistrationHubProps> = ({
  teachers,
  enrollTeacherAction,
  batchRegisterTeachers,
  isBatchRegistering,
  deleteEntity,
  schoolId,
}) => {
  const batchFileInputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tighter">Teacher Registration Hub</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.3em] mt-2">Faculty Onboarding Suite</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 lg:p-10 rounded-[28px] sm:rounded-[40px] lg:rounded-[48px] shadow-premium border border-slate-100 dark:border-slate-800 text-center space-y-4 sm:space-y-6">
          <div className="w-20 h-20 bg-indigo-500/10 text-indigo-500 rounded-[24px] flex items-center justify-center text-3xl mx-auto shadow-inner">
            <i className="fas fa-chalkboard-user"></i>
          </div>
          <h4 className="text-xl sm:text-2xl font-black tracking-tight">Register Teacher</h4>
          <p className="text-slate-400 text-sm font-semibold max-w-xs mx-auto">Create a teacher account and setup registration credentials.</p>
          <button
            onClick={enrollTeacherAction}
            className="w-full py-4 bg-indigo-500 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
          >
            Register Teacher
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 lg:p-10 rounded-[28px] sm:rounded-[40px] lg:rounded-[48px] shadow-premium border border-slate-100 dark:border-slate-800 text-center space-y-4 sm:space-y-6">
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-[24px] flex items-center justify-center text-3xl mx-auto shadow-inner">
            <i className="fas fa-file-import"></i>
          </div>
          <h4 className="text-xl sm:text-2xl font-black tracking-tight">Batch Teacher Registration</h4>
          <p className="text-slate-400 text-sm font-semibold max-w-xs mx-auto">Import teachers from spreadsheet files (.csv, .xls, .xlsx, .ods).</p>
          <button
            onClick={() => {
              if (isBatchRegistering) return;
              batchFileInputRef.current?.click();
            }}
            disabled={isBatchRegistering}
            className={`w-full py-4 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all ${isBatchRegistering ? 'bg-emerald-300 cursor-not-allowed' : 'bg-emerald-500 shadow-emerald-500/20'}`}
          >
            {isBatchRegistering ? 'Importing...' : 'Upload Spreadsheet'}
          </button>
          <input
            ref={batchFileInputRef}
            type="file"
            accept=".csv,.tsv,.xls,.xlsx,.ods"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await batchRegisterTeachers(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[32px] lg:rounded-[40px] p-5 sm:p-6 lg:p-8 shadow-premium border border-slate-100 dark:border-slate-800">
        <h4 className="text-lg sm:text-xl font-black mb-6 sm:mb-8 flex items-center gap-3">
          <div className="w-1.5 h-6 bg-rose-500 rounded-full"></div>
          Recent Teachers (Quick Termination)
        </h4>
        <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {teachers.map(t => (
              <div key={t.id} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[32px] flex items-center justify-between group">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-700 flex items-center justify-center font-black text-brand-500 shadow-sm">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-black truncate max-w-[120px]">{t.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{t.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteEntity(t.id, 'student')}
                  className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 text-slate-300 hover:text-rose-500 transition-all shadow-sm flex items-center justify-center"
                >
                  <i className="fas fa-trash-can text-sm"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherRegistrationHub;
