import React, { useState } from 'react';
import { updateSchoolDeletePassword } from '../../services/adminSecurity';

interface SecuritySettingsProps {
  schoolId: string | undefined;
}

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({ schoolId }) => {
  const [deletePassword, setDeletePassword] = useState('');
  const [isSecuritySaving, setIsSecuritySaving] = useState(false);
  const [securityStatus, setSecurityStatus] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedSchoolId = String(schoolId || '').trim();
    if (!normalizedSchoolId) return;

    const nextDeletePassword = deletePassword.trim();
    if (!nextDeletePassword) {
      setSecurityError('Please enter a password.');
      return;
    }

    setIsSecuritySaving(true);
    setSecurityError(null);
    setSecurityStatus(null);

    try {
      await updateSchoolDeletePassword(normalizedSchoolId, nextDeletePassword);
      setSecurityStatus('Universal delete password updated successfully!');
      setDeletePassword('');
    } catch (err: any) {
      console.error('Security update error:', err);
      setSecurityError(err.message || 'Failed to update security settings');
    } finally {
      setIsSecuritySaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 sm:p-8 shadow-premium space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-500">
          <i className="fas fa-shield-alt text-xl"></i>
        </div>
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Administrative Security</h3>
          <p className="text-slate-500 text-xs font-medium">Protect critical actions with a universal confirmation password.</p>
        </div>
      </div>

      {securityError && <p className="text-xs font-bold text-rose-600 bg-rose-50 rounded-xl px-4 py-3">{securityError}</p>}
      {securityStatus && <p className="text-xs font-bold text-brand-700 bg-brand-50 rounded-xl px-4 py-3">{securityStatus}</p>}

      <form onSubmit={handleSecuritySubmit} className="space-y-4">
        <label className="space-y-2 block">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Universal Delete Password</span>
          <div className="relative">
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold pr-10"
              placeholder="********"
              autoComplete="new-password"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
              <i className="fas fa-lock"></i>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
            This password will be required when performing irreversible actions like deleting student or staff nodes.
          </p>
        </label>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSecuritySaving}
            className="rounded-2xl bg-slate-900 hover:bg-black text-white px-8 py-3 text-[10px] font-black uppercase tracking-widest disabled:opacity-60 transition-all active:scale-95 shadow-lg shadow-slate-200"
          >
            {isSecuritySaving ? 'Syncing Security...' : 'Save Security Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
