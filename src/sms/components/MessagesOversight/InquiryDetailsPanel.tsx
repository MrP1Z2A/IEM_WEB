import React from 'react';
import { ParentInquiryRecord } from '../MessagesOversight';

interface InquiryDetailsPanelProps {
  activeInquiry: ParentInquiryRecord | null;
  isUpdatingStatus: boolean;
  onUpdateStatus: (inquiry: ParentInquiryRecord, status: 'unread' | 'read' | 'resolved') => Promise<void> | void;
  onClose: () => void;
  formatExactDate: (iso: string) => string;
  getInquiryStatusClasses: (status: string) => string;
  getInquiryUrgencyClasses: (urgency: string) => string;
  normalizeInquiryStatus: (value?: string | null) => string;
}

export const InquiryDetailsPanel: React.FC<InquiryDetailsPanelProps> = ({
  activeInquiry,
  isUpdatingStatus,
  onUpdateStatus,
  onClose,
  formatExactDate,
  getInquiryStatusClasses,
  getInquiryUrgencyClasses,
  normalizeInquiryStatus,
}) => {
  if (!activeInquiry) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center opacity-30">
        <div className="w-24 h-24 rounded-[32px] bg-amber-500/10 flex items-center justify-center text-5xl text-amber-500 mb-6">
          <i className="fas fa-envelope-open-text"></i>
        </div>
        <h3 className="text-xl font-black text-slate-700 dark:text-white uppercase tracking-wide">Select a parent inquiry</h3>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">to view the submitted message and update its status</p>
      </div>
    );
  }

  return (
    <>
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${getInquiryStatusClasses(activeInquiry.status)}`}>
              {normalizeInquiryStatus(activeInquiry.status) || 'unread'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${getInquiryUrgencyClasses(activeInquiry.urgency)}`}>
              {activeInquiry.urgency}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {activeInquiry.department}
            </span>
          </div>
          <h4 className="text-lg font-black text-slate-800 dark:text-white break-words">{activeInquiry.subject}</h4>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">
            From {activeInquiry.parent_email} · {formatExactDate(activeInquiry.created_at)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {(['unread', 'read', 'resolved'] as const).map(status => {
            const isCurrent = normalizeInquiryStatus(activeInquiry.status) === status;
            return (
              <button
                key={status}
                type="button" onClick={() => void onUpdateStatus(activeInquiry, status)}
                disabled={isCurrent || isUpdatingStatus}
                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isCurrent ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-500 border border-slate-200 hover:border-brand-400 hover:text-brand-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {status}
              </button>
            );
          })}
          <button onClick={onClose}
            aria-label="Close inquiry panel"
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all" type="button">
            <i className="fas fa-xmark text-sm"></i>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[
            { label: 'Parent Email', value: activeInquiry.parent_email, icon: 'fa-at' },
            { label: 'Department', value: activeInquiry.department, icon: 'fa-building-columns' },
            { label: 'Urgency', value: activeInquiry.urgency, icon: 'fa-bolt' },
            { label: 'Status', value: activeInquiry.status, icon: 'fa-circle-check' },
            { label: 'Received', value: formatExactDate(activeInquiry.created_at), icon: 'fa-clock' },
            { label: 'School ID', value: activeInquiry.school_id, icon: 'fa-school' },
          ].map(field => (
            <div key={field.label} className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <i className={`fas ${field.icon} text-xs`}></i>
                <p className="text-[9px] font-black uppercase tracking-widest">{field.label}</p>
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-100 break-all">{field.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-950 rounded-[28px] border border-slate-100 dark:border-slate-800 p-6">
          <div className="flex items-center gap-2 mb-4 text-slate-400">
            <i className="fas fa-envelope text-sm"></i>
            <p className="text-[10px] font-black uppercase tracking-widest">Parent Message</p>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-5 py-4 text-sm leading-7 text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
            {activeInquiry.message}
          </div>
        </div>
      </div>
    </>
  );
};
