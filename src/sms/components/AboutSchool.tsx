import React, { useEffect, useState, useReducer } from 'react';
import { supabase } from '../supabaseClient';
import { getUnicornSchoolLogoDataUri, isUnicornSchoolLogo } from '../../shared/branding/unicornSchoolLogo';
import { ProfileForm } from './AboutSchool/ProfileForm';
import { SecuritySettings } from './AboutSchool/SecuritySettings';

interface AboutSchoolProps {
  schoolId: string | undefined;
  onSchoolProfileChange?: (profile: Partial<SchoolMetadata>) => void;
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

type OperationState = {
  isLoading: boolean;
  isSaving: boolean;
  status: string | null;
  error: string | null;
};

type OperationAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS' }
  | { type: 'FETCH_FAILURE'; error: string }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_START_WITH_STATUS'; status: string }
  | { type: 'SAVE_SUCCESS'; status: string }
  | { type: 'SAVE_FAILURE'; error: string }
  | { type: 'CLEAR_STATUS' }
  | { type: 'SET_STATUS'; status: string | null }
  | { type: 'SET_ERROR'; error: string | null };

const initialOperationState: OperationState = {
  isLoading: true,
  isSaving: false,
  status: null,
  error: null,
};

function operationReducer(state: OperationState, action: OperationAction): OperationState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, isLoading: true, error: null, status: null };
    case 'FETCH_SUCCESS':
      return { ...state, isLoading: false };
    case 'FETCH_FAILURE':
      return { ...state, isLoading: false, error: action.error };
    case 'SAVE_START':
      return { ...state, isSaving: true, error: null, status: null };
    case 'SAVE_START_WITH_STATUS':
      return { ...state, isSaving: true, status: action.status, error: null };
    case 'SAVE_SUCCESS':
      return { ...state, isSaving: false, status: action.status };
    case 'SAVE_FAILURE':
      return { ...state, isSaving: false, error: action.error };
    case 'CLEAR_STATUS':
      return { ...state, status: null, error: null };
    case 'SET_STATUS':
      return { ...state, status: action.status };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    default:
      return state;
  }
}

export default function AboutSchool({ schoolId, onSchoolProfileChange }: AboutSchoolProps) {
  const [data, setData] = useState<SchoolMetadata | null>(null);
  const [operationState, dispatch] = useReducer(operationReducer, initialOperationState);
  const { isLoading, isSaving, status, error } = operationState;

  const [defaultLogoUrl, setDefaultLogoUrl] = useState('');

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
    dispatch({ type: 'FETCH_START' });
    try {
      const nextLogoUrl = await getUnicornSchoolLogoDataUri();
      const { data: school, error: loadError } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .single();

      if (loadError) throw loadError;
      if (school) {
        const usesManagedLogo = !school.logo_url || school.logo_url === nextLogoUrl || isUnicornSchoolLogo(school.logo_url);

        if (usesManagedLogo && school.logo_url !== nextLogoUrl) {
          const { error: logoUpdateError } = await supabase
            .from('schools')
            .update({ logo_url: nextLogoUrl })
            .eq('id', schoolId);

          if (logoUpdateError) throw logoUpdateError;
          dispatch({ type: 'SET_STATUS', status: 'Header logo applied to this school profile.' });
        }

        const resolvedLogoUrl = usesManagedLogo ? nextLogoUrl : (school.logo_url || '');

        setData({
          ...school,
          logo_url: resolvedLogoUrl,
        });
        setFormData({
          name: school.name || '',
          about: school.about || '',
          phone: school.phone || '',
          email: school.email || '',
          address: school.address || '',
          logo_url: resolvedLogoUrl,
          banner_url: school.banner_url || ''
        });
        onSchoolProfileChange?.({
          name: school.name || '',
          logo_url: resolvedLogoUrl,
          banner_url: school.banner_url || '',
        });
      }
      dispatch({ type: 'FETCH_SUCCESS' });
    } catch (err: any) {
      console.error('Error loading school data:', err);
      dispatch({ type: 'FETCH_FAILURE', error: err.message || 'Failed to load school data' });
    }
  };

  useEffect(() => {
    void loadSchoolData();
  }, [schoolId, onSchoolProfileChange]);

  useEffect(() => {
    let isActive = true;

    void getUnicornSchoolLogoDataUri().then((url) => {
      if (isActive) {
        setDefaultLogoUrl(url);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo_url' | 'banner_url') => {
    const file = e.target.files?.[0];
    if (!file) return;

    dispatch({ type: 'SAVE_START_WITH_STATUS', status: `Uploading ${field.split('_')[0]}...` });
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
        dispatch({ type: 'SAVE_SUCCESS', status: `${field.split('_')[0].toUpperCase()} uploaded.` });
      } else {
        dispatch({ type: 'SAVE_SUCCESS', status: '' });
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      dispatch({ type: 'SAVE_FAILURE', error: `Failed to upload image: ${err.message}` });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return;

    dispatch({ type: 'SAVE_START' });

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
      setData(prev => prev ? ({
        ...prev,
        name: formData.name,
        about: formData.about,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        logo_url: formData.logo_url,
        banner_url: formData.banner_url,
      }) : prev);
      onSchoolProfileChange?.({
        name: formData.name,
        about: formData.about,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        logo_url: formData.logo_url,
        banner_url: formData.banner_url,
      });
      dispatch({ type: 'SAVE_SUCCESS', status: 'School profile updated successfully!' });
    } catch (err: any) {
      console.error('Update error:', err);
      dispatch({ type: 'SAVE_FAILURE', error: err.message || 'Failed to update school profile' });
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
        <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-brand-200">Institutional Management</p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter mt-2">About School</h2>
        <p className="text-slate-200 mt-3 text-sm sm:text-base">Manage your school's public profile, contact info, and branding assets.</p>
      </div>

      {(error || status) && (
        <div className="space-y-2">
          {error && <p className="text-sm font-semibold text-rose-600 bg-rose-50 rounded-2xl px-4 py-3">{error}</p>}
          {status && <p className="text-sm font-semibold text-brand-700 bg-brand-50 rounded-2xl px-4 py-3">{status}</p>}
        </div>
      )}

      <ProfileForm
        formData={formData}
        setFormData={setFormData}
        isSaving={isSaving}
        defaultLogoUrl={defaultLogoUrl}
        handleInputChange={handleInputChange}
        handleFileUpload={handleFileUpload}
        handleSubmit={handleSubmit}
      />

      <SecuritySettings schoolId={schoolId} />
    </div>
  );
}
