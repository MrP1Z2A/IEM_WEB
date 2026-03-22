import React from 'react';

/**
 * EditModal Component
 * 
 * A generic modal used for editing various entity types (students, teachers, subjects, etc.).
 * It dynamically generates input fields based on the data provided.
 */

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTarget: { type: string; data: any } | null;
  setEditTarget: (target: any) => void;
  onUpdate: () => void;
}

const EditModal: React.FC<EditModalProps> = ({
  isOpen,
  onClose,
  editTarget,
  setEditTarget,
  onUpdate
}) => {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  if (!isOpen || !editTarget) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onUpdate();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[24px] sm:rounded-[36px] lg:rounded-[48px] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">

        {/* Modal Header */}
        <div className="p-5 sm:p-8 lg:p-10 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center gap-4">
          <h3 className="text-xl sm:text-2xl font-black tracking-tight break-words">Modify {editTarget.type} Node</h3>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-10 h-10 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-50"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Dynamic Form Fields */}
        <div className="p-5 sm:p-8 lg:p-10 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar">
          {Object.entries(editTarget.data).map(([key, value]) => {
            // Skip internal or complex fields
            if (
              key === 'id' ||
              key === 'school_id' ||
              key === 'icon' ||
              key === 'color' ||
              key === 'bg' ||
              key === 'avatar' ||
              key === 'avatar_url' ||
              key === 'profile_image_url' ||
              key === 'image_url' ||
              key === 'created_at' ||
              key === 'auth_user_id' ||
              key === 'temp_password' ||
              key === 'temp_password_created_at' ||
              typeof value === 'object'
            ) return null;
            if (editTarget.type === 'student' && (key === 'attendanceRate' || key === 'status' || key === 'type')) return null;

            // Standard text/number input
            return (
              <div key={key}>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">{key.replace(/_/g, ' ')}</label>
                <input
                  type={typeof value === 'number' ? 'number' : 'text'}
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all disabled:opacity-50"
                  value={value as string}
                  onChange={(e) => setEditTarget({ ...editTarget, data: { ...editTarget.data, [key]: typeof value === 'number' ? Number(e.target.value) : e.target.value } })}
                />
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="p-5 sm:p-8 lg:p-10 bg-slate-50 dark:bg-slate-900/50 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`flex-1 py-5 ${isSubmitting ? 'bg-brand-300' : 'bg-brand-500'} text-white font-black rounded-3xl text-sm uppercase tracking-widest shadow-xl shadow-brand-500/20 active:scale-95 transition-all flex items-center justify-center gap-2`}
          >
            {isSubmitting && <i className="fas fa-circle-notch fa-spin"></i>}
            {isSubmitting ? 'Updating...' : 'Update'}
          </button>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-10 py-5 bg-white dark:bg-slate-800 font-black rounded-3xl text-sm uppercase tracking-widest border border-slate-100 dark:border-slate-700 active:scale-95 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditModal;
