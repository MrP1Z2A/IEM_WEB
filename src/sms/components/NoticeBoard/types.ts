export type NoticeItem = {
  id: string;
  title: string;
  message: string;
  notice_date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  file_path: string | null;
  file_name: string | null;
  created_at: string;
};

export const NOTICE_FILES_BUCKET = 'notice_files';
export const MAX_NOTICE_FILE_SIZE = 20 * 1024 * 1024;
export const priorityOptions: Array<NoticeItem['priority']> = ['low', 'medium', 'high', 'urgent'];

export const priorityBadgeClassMap: Record<NoticeItem['priority'], string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-brand-100 text-brand-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-rose-100 text-rose-700',
};

export const getTodayIso = () => new Date().toISOString().slice(0, 10);
