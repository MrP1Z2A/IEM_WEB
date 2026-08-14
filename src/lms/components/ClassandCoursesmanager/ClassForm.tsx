import React from 'react';
import { ClassRow } from '../ClassandCoursesmanager';

interface ClassFormProps {
  className: string;
  setClassName: (name: string) => void;
  classOuterColor: string;
  setClassOuterColor: (color: string) => void;
  isClassFormOpen: boolean;
  setIsClassFormOpen: (open: boolean) => void;
  editingClassId: string | null;
  resetClassForm: () => void;
  createOrUpdateClass: () => Promise<void>;
  classImageInputRef: React.RefObject<HTMLInputElement | null>;
  classImage: File | null;
  setClassImage: (file: File | null) => void;
}

export const ClassForm: React.FC<ClassFormProps> = ({
  className,
  setClassName,
  classOuterColor,
  setClassOuterColor,
  isClassFormOpen,
  setIsClassFormOpen,
  editingClassId,
  resetClassForm,
  createOrUpdateClass,
  classImageInputRef,
  classImage,
  setClassImage,
}) => {
  if (!isClassFormOpen) return null;

  return (
    <div className="bg-white/10 backdrop-blur-2xl shadow-premium p-10 rounded-[40px] border border-white/20 animate-slideIn">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="space-y-3">
            <label htmlFor="classIdentityInput" className="text-[10px] font-black uppercase tracking-widest text-[#4ea59d]">Class Identity</label>
            <input
              id="classIdentityInput"
              type="text"
              placeholder="e.g. Grade 10-A, Computer Science 2024"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full bg-[#0a1a19] border border-white/10 p-5 rounded-[24px] outline-none font-bold text-slate-900 focus:border-[#4ea59d] transition-all"
            />
          </div>

          <div className="space-y-3">
            <label htmlFor="colorPicker" className="text-[10px] font-black uppercase tracking-widest text-[#4ea59d]">Visual Identity (Optional)</label>
            <div className="bg-[#0a1a19] rounded-[24px] border border-white/10 p-5 flex items-center gap-4">
              <button 
                 type="button"
                 aria-label="Pick cover color"
                 className="w-14 h-14 rounded-2xl flex items-center justify-center cursor-pointer border border-white/10"
                 style={{ backgroundColor: classOuterColor }}
                 onClick={() => document.getElementById('colorPicker')?.click()}
              >
                <i className="fas fa-palette text-slate-600"></i>
              </button>
              <input
                id="colorPicker"
                type="color"
                value={classOuterColor}
                onChange={(e) => setClassOuterColor(e.target.value)}
                className="hidden"
              />
              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => classImageInputRef.current?.click()}
                  className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-slate-900 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  {classImage ? 'Change Image' : 'Add Cover Image'}
                </button>
                <input aria-label="Action"
                  ref={classImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setClassImage(e.target.files[0]);
                  }}
                  className="hidden"
                />
                {classImage && <p className="mt-2 text-[9px] text-[#4ea59d] font-bold uppercase truncate">Selected: {classImage.name}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 bg-[#0a1a19]/50 rounded-[32px] border border-white/5 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-black text-slate-900 uppercase mb-4">Creation Preview</h4>
            <div className="p-6 rounded-3xl border border-white/10" style={{ backgroundColor: '#0a1a19' }}>
               <div 
                  className="w-full aspect-video rounded-2xl mb-4 border border-white/5 flex items-center justify-center overflow-hidden" 
                  style={{ backgroundColor: classOuterColor }}
                >
                  {classImage ? (
                    <img src={URL.createObjectURL(classImage)} className="w-full h-full object-cover" alt="preview" />
                  ) : (
                    <i className="fas fa-graduation-cap text-3xl text-slate-400"></i>
                  )}
               </div>
               <p className="font-black text-lg">{className || 'Your Class Name'}</p>
               <p className="text-[10px] font-black text-[#4ea59d] uppercase tracking-widest mt-1">Ready for registration</p>
            </div>
          </div>

          <div className="flex gap-4 mt-8">
             <button
                onClick={resetClassForm}
                className="flex-1 py-4 rounded-[20px] bg-white/5 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-900 transition-all"
               type="button">
                Discard
              </button>
              <button
                type="button" onClick={() => void createOrUpdateClass()}
                className="flex-[2] py-4 rounded-[20px] bg-[#4ea59d] text-slate-900 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-[#4ea59d]/20 active:scale-95 transition-all"
              >
                {editingClassId ? 'Save Changes' : 'Confirm Registration'}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};
