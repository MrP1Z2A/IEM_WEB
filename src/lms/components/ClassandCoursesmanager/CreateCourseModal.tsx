import React from 'react';

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  newCourseName: string;
  setNewCourseName: (name: string) => void;
  newCourseImage: File | null;
  setNewCourseImage: (file: File | null) => void;
  newCourseError: string | null;
  setNewCourseError: (err: string | null) => void;
  newCourseImageInputRef: React.RefObject<HTMLInputElement | null>;
  createClassCourse: () => Promise<void>;
  isCreating: boolean;
}

export const CreateCourseModal: React.FC<CreateCourseModalProps> = ({
  isOpen,
  onClose,
  newCourseName,
  setNewCourseName,
  newCourseImage,
  setNewCourseImage,
  newCourseError,
  setNewCourseError,
  newCourseImageInputRef,
  createClassCourse,
  isCreating,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] glass-panel bg-black/60 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0a1a19] rounded-[40px] border border-white/10 p-10 space-y-8 animate-fadeIn text-slate-800">
         <header className="flex justify-between items-center">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Add Course</h3>
            <button type="button" onClick={onClose} aria-label="Close modal" className="text-slate-500 hover:text-slate-900 transition-colors"><i className="fas fa-times"></i></button>
         </header>
         <div className="space-y-6">
            <div className="space-y-3">
              <label htmlFor="createCourseNameInput" className="text-[10px] font-black uppercase tracking-widest text-[#4ea59d]">Curriculum Title</label>
              <input
                id="createCourseNameInput"
                type="text"
                value={newCourseName}
                onChange={(e) => { setNewCourseName(e.target.value); if (newCourseError) setNewCourseError(null); }}
                placeholder="Enter course name"
                aria-label="Course name"
                className="w-full bg-white/5 border border-white/10 p-5 rounded-[24px] outline-none font-bold text-slate-900 focus:border-[#4ea59d] transition-all"
              />
              {newCourseError && <p className="text-[10px] font-bold text-rose-500 px-2">{newCourseError}</p>}
            </div>
            <div className="space-y-3">
              <label htmlFor="createCourseImageInput" className="text-[10px] font-black uppercase tracking-widest text-[#4ea59d]">Course Illustration</label>
              <div className="bg-white/5 rounded-[24px] border border-white/10 p-5">
                <button
                  type="button"
                  onClick={() => newCourseImageInputRef.current?.click()}
                  className="w-full py-4 rounded-xl bg-white/5 text-slate-900 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  {newCourseImage ? 'Change Image' : 'Select Graphic'}
                </button>
                <input
                  id="createCourseImageInput"
                  ref={newCourseImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => { if (e.target.files?.[0]) setNewCourseImage(e.target.files[0]); }}
                  className="hidden"
                  aria-label="Upload Course Image"
                />
                {newCourseImage && <p className="mt-2 text-[9px] text-[#4ea59d] font-bold uppercase truncate">Selected: {newCourseImage.name}</p>}
              </div>
            </div>
         </div>
         <button
            type="button" onClick={() => void createClassCourse()}
            disabled={isCreating}
            className="w-full py-5 rounded-[24px] bg-[#4ea59d] text-slate-900 font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl shadow-[#4ea59d]/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {isCreating ? 'Registering...' : 'Add to Catalog'}
          </button>
      </div>
    </div>
  );
};
