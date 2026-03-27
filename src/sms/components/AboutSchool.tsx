import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

interface AboutSchoolProps {
  schoolId: string | undefined;
}

interface SchoolMetadata {
  id: string;
  name: string;
  about: string | null;
  logo_url: string | null;
  banner_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export default function AboutSchool({ schoolId }: AboutSchoolProps) {
  const [data, setData] = useState<SchoolMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    about: '',
    phone: '',
    email: '',
    address: '',
    logo_url: '',
    banner_url: ''
  });

  const loadSchoolData = async () => {
    if (!schoolId) return;
    setIsLoading(true);
    try {
      const { data: school, error: loadError } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .single();

      if (loadError) throw loadError;
      if (school) {
        setData(school);
        setFormData({
          name: school.name || '',
          about: school.about || '',
          phone: school.phone || '',
          email: school.email || '',
          address: school.address || '',
          logo_url: school.logo_url || '',
          banner_url: school.banner_url || ''
        });
      }
    } catch (err: any) {
      console.error('Error loading school data:', err);
      setError(err.message || 'Failed to load school data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSchoolData();
  }, [schoolId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo_url' | 'banner_url') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    setStatus(`Uploading ${field.split('_')[0]}...`);
    try {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `school/${field}-${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('announcements') // Reusing existing bucket
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('announcements')
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        setFormData(prev => ({ ...prev, [field]: urlData.publicUrl }));
        setStatus(`${field.split('_')[0].toUpperCase()} uploaded.`);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(`Failed to upload image: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return;

    setIsSaving(true);
    setError(null);
    setStatus(null);

    try {
      const { error: updateError } = await supabase
        .from('schools')
        .update({
          name: formData.name,
          about: formData.about,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          logo_url: formData.logo_url,
          banner_url: formData.banner_url
        })
        .eq('id', schoolId);

      if (updateError) throw updateError;
      setStatus('School profile updated successfully!');
    } catch (err: any) {
      console.error('Update error:', err);
      setError(err.message || 'Failed to update school profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      <div className="bg-gradient-to-r from-brand-900 via-indigo-800 to-purple-700 rounded-[40px] p-6 sm:p-8 lg:p-10 text-white shadow-premium">
        <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Institutional Management</p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter mt-2">About School</h2>
        <p className="text-slate-200 mt-3 text-sm sm:text-base">Manage your school's public profile, contact info, and branding assets.</p>
      </div>

      {(error || status) && (
        <div className="space-y-2">
          {error && <p className="text-sm font-semibold text-rose-600 bg-rose-50 rounded-2xl px-4 py-3">{error}</p>}
          {status && <p className="text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-2xl px-4 py-3">{status}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 sm:p-8 shadow-premium space-y-8">
        {/* Branding Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-[0.1em] text-slate-400">School Logo</h3>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner">
                {formData.logo_url ? (
                  <img src={formData.logo_url} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <i className="fas fa-school text-3xl text-slate-300"></i>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  onChange={(e) => handleFileUpload(e, 'logo_url')}
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
                <p className="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">Square image recommended (200x200)</p>
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
                  onChange={(e) => handleFileUpload(e, 'banner_url')}
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
    </div>
  );
}
