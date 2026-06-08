import React from 'react';

interface ProfileFormData {
  name: string;
  about: string;
  phone: string;
  email: string;
  address: string;
  logo_url: string;
  banner_url: string;
}

interface ProfileFormProps {
  formData: ProfileFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProfileFormData>>;
  isSaving: boolean;
  defaultLogoUrl: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, field: 'logo_url' | 'banner_url') => Promise<void>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({
  formData,
  setFormData,
  isSaving,
  defaultLogoUrl,
  handleInputChange,
  handleFileUpload,
  handleSubmit
}) => {
  const isHeaderLogoPreview = Boolean(defaultLogoUrl) && formData.logo_url === defaultLogoUrl;

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 sm:p-8 shadow-premium space-y-8">
      {/* Branding Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-[0.1em] text-slate-400">School Logo</h3>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner">
              {formData.logo_url ? (
                <img src={formData.logo_url} alt="Logo" className={`w-full h-full ${isHeaderLogoPreview ? 'object-contain' : 'object-cover'}`} />
              ) : (
                <i className="fas fa-school text-3xl text-slate-300"></i>
              )}
            </div>
            <div className="flex-1">
              <input
                type="file"
                onChange={(e) => void handleFileUpload(e, 'logo_url')}
                className="hidden"
                id="logo-upload"
                accept="image/*"
              />
              <label
                htmlFor="logo-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-black uppercase tracking-widest rounded-xl cursor-pointer transition-all"
              >
                <i className="fas fa-upload"></i>
                Change Logo
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!defaultLogoUrl) return;
                    setFormData(prev => ({ ...prev, logo_url: defaultLogoUrl }));
                  }}
                  disabled={!defaultLogoUrl}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 hover:border-brand-400 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-brand-600 transition-all"
                >
                  <i className="fas fa-wand-magic-sparkles"></i>
                  Apply Header Logo
                </button>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {isHeaderLogoPreview ? 'Matches the top-left school badge' : 'Square image recommended (200x200)'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-[0.1em] text-slate-400">Campus Banner</h3>
          <div className="relative group rounded-3xl overflow-hidden aspect-[3/1] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner">
            {formData.banner_url ? (
              <img src={formData.banner_url} alt="Banner" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                 <i className="fas fa-image text-3xl"></i>
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <input
                type="file"
                onChange={(e) => void handleFileUpload(e, 'banner_url')}
                className="hidden"
                id="banner-upload"
                accept="image/*"
              />
              <label
                htmlFor="banner-upload"
                className="px-4 py-2 bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-black uppercase tracking-widest rounded-xl cursor-pointer hover:bg-white/40 transition-all"
              >
                Update Banner
              </label>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-slate-100 dark:border-slate-800" />

      {/* Info Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <label className="space-y-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Institutional Title</span>
          <input
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
            placeholder="Full School Name"
          />
        </label>

        <label className="space-y-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Contact Email</span>
          <input
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
            placeholder="admissions@school.edu"
          />
        </label>

        <label className="space-y-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Phone Number</span>
          <input
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
            placeholder="+1 (555) 000-0000"
          />
        </label>

         <label className="space-y-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Physical Address</span>
          <input
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
            placeholder="123 Campus Dr, Education City"
          />
        </label>
      </div>

      <label className="space-y-2 block">
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">About the Institution</span>
        <textarea
          name="about"
          value={formData.about}
          onChange={handleInputChange}
          className="w-full h-40 resize-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
          placeholder="Describe your school's mission, history, and achievements..."
        />
      </label>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-2xl bg-brand-500 hover:bg-brand-600 text-white px-8 py-4 text-xs font-black uppercase tracking-widest disabled:opacity-60 shadow-lg shadow-brand-500/20 transition-all hover:scale-105 active:scale-95"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-white"></div>
              Saving Profile...
            </span>
          ) : 'Update Institutional Profile'}
        </button>
      </div>
    </form>
  );
};
