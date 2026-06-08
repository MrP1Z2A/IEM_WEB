import React from 'react';

interface EditCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  editCourseName: string;
  setEditCourseName: (name: string) => void;
  editCourseCurrentImageUrl: string | null;
  setEditCourseCurrentImageUrl: (url: string | null) => void;
  editCourseImage: File | null;
  setEditCourseImage: (file: File | null) => void;
  editCourseError: string | null;
  setEditCourseError: (err: string | null) => void;
  editCourseImageInputRef: React.RefObject<HTMLInputElement | null>;
  saveCourseEdits: () => Promise<void>;
  isUpdating: boolean;
}

export const EditCourseModal: React.FC<EditCourseModalProps> = ({
  isOpen,
  onClose,
  editCourseName,
  setEditCourseName,
  editCourseCurrentImageUrl,
  editCourseImage,
  setEditCourseImage,
  editCourseError,
  setEditCourseError,
  editCourseImageInputRef,
  saveCourseEdits,
  isUpdating,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] glass-panel bg-black/60 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0a1a19] rounded-[40px] border border-white/10 p-10 space-y-8 animate-fadeIn text-slate-800">
         <header className="flex justify-between items-center">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Edit Course</h3>
            <button onClick={onClose} aria-label="Close modal" className="text-slate-500 hover:text-slate-900 transition-colors" type="button"><i className="fas fa-times"></i></button>
         </header>
         <div className="space-y-6">
            <div className="space-y-3">
              <label htmlFor="editCourseNameInput" className="text-[10px] font-black uppercase tracking-widest text-[#4ea59d]">Curriculum Title</label>
              <input
                id="editCourseNameInput"
                type="text"
                value={editCourseName}
                onChange={(e) => { setEditCourseName(e.target.value); if (editCourseError) setEditCourseError(null); }}
                placeholder="Enter course name"
                aria-label="Edit course name"
                className="w-full bg-white/5 border border-white/10 p-5 rounded-[24px] outline-none font-bold text-slate-900 focus:border-[#4ea59d] transition-all"
              />
              {editCourseError && <p className="text-[10px] font-bold text-rose-500 px-2">{editCourseError}</p>}
            </div>
            <div className="space-y-3">
              <label htmlFor="editCourseImageInput" className="text-[10px] font-black uppercase tracking-widest text-[#4ea59d]">Course Illustration</label>
              <div className="bg-white/5 rounded-[24px] border border-white/10 p-5">
                {editCourseCurrentImageUrl && !editCourseImage && (
                  <div className="mb-4 w-full h-32 rounded-xl overflow-hidden bg-slate-800">
                    <img src={editCourseCurrentImageUrl} alt="Current" className="w-full h-full object-cover" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => editCourseImageInputRef.current?.click()}
                  className="w-full py-4 rounded-xl bg-white/5 text-slate-900 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  {editCourseImage ? 'Change Image' : 'Select Graphic'}
                </button>
                <input
                  id="editCourseImageInput"
                  ref={editCourseImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => { if (e.target.files?.[0]) setEditCourseImage(e.target.files[0]); }}
                  className="hidden"
                  aria-label="Upload Edit Course Image"
                />
                {editCourseImage && <p className="mt-2 text-[9px] text-[#4ea59d] font-bold uppercase truncate">Selected: {editCourseImage.name}</p>}
              </div>
            </div>
         </div>
         <button
            type="button" onClick={() => void saveCourseEdits()}
            disabled={isUpdating}
            className="w-full py-5 rounded-[24px] bg-[#4ea59d] text-slate-900 font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl shadow-[#4ea59d]/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </button>
      </div>
    </div>
  );
};
