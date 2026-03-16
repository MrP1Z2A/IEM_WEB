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
    throw new Error('You must be signed in to modify school data.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('school_id, role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    throw new Error(profileError.message || 'Failed to load tenant profile.');
  }

  const schoolId = String(profile?.school_id || '').trim();
  if (!schoolId) {
    throw new Error('No school is assigned to this account. Complete school setup first.');
  }

  return {
    userId: user.id,
    schoolId,
    role: String(profile?.role || ''),
  };
};

export const withSchoolId = <T extends Record<string, any>>(payload: T, schoolId: string): T & { school_id: string } => ({
  ...payload,
  school_id: schoolId,
});

export const withSchoolIdRows = <T extends Record<string, any>>(rows: T[], schoolId: string): Array<T & { school_id: string }> => (
  rows.map((row) => ({ ...row, school_id: schoolId }))
);
