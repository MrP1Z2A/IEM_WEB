import { supabase } from '../supabaseClient';

export type TenantContext = {
  userId: string;
  schoolId: string;
  role: string;
};

export const getCurrentTenantContext = async (): Promise<TenantContext> => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message || 'Failed to resolve current user.');
  }

  if (!user?.id) {
    throw new Error('You must be signed in to access school data.');
  }

  let profile: any = null;
  let profileError: any = null;
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    const { data, error } = await supabase
      .from('profiles')
      .select('school_id, role')
      .eq('id', user.id)
      .maybeSingle();
      
    profile = data;
    profileError = error;

    if (!error && data) break;
    
    attempts++;
    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
    }
  }

  if (profileError) {
    console.error(`Tenant profile error (Attempt ${attempts}):`, profileError);
    throw new Error(`Cloud Sync Error: ${profileError.message || 'Failed to load profile'}`);
  }

  if (!profile) {
    console.warn(`No profile found for user ${user.id} after ${attempts} attempts`);
    throw new Error('Sync Failed: No profile found for this account. Please refresh or contact admin.');
  }

  const schoolId = String(profile.school_id || '').trim();
  if (!schoolId) {
    throw new Error('Sync Failed: No school is assigned to this account. Complete school setup first.');
  }

  return {
    userId: user.id,
    schoolId,
    role: String(profile.role || ''),
  };
};

export const withSchoolId = <T extends Record<string, any>>(payload: T, schoolId: string): T & { school_id: string } => ({
  ...payload,
  school_id: schoolId,
});

export const withSchoolIdRows = <T extends Record<string, any>>(rows: T[], schoolId: string): Array<T & { school_id: string }> => (
  rows.map((row) => ({ ...row, school_id: schoolId }))
);
