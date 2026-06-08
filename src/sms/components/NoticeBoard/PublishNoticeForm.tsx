import React from 'react';
import { NoticeItem, priorityOptions } from './types';
import { NoticeBoardState, NoticeBoardAction } from './NoticeBoardReducer';

interface PublishNoticeFormProps {
  state: NoticeBoardState;
  dispatch: React.Dispatch<NoticeBoardAction>;
  createNotice: (event: React.FormEvent) => Promise<void>;
}

export default function PublishNoticeForm({ state, dispatch, createNotice }: PublishNoticeFormProps) {
  return (
    <form onSubmit={createNotice} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 sm:p-8 shadow-premium space-y-5">
      <h3 className="text-lg font-black tracking-tight">Publish Notice</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Title</span>
          <input
            value={state.title}
            onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'title', value: e.target.value })}
            placeholder="Holiday Announcement"
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
            disabled={state.isSaving}
          />
        </label>
        <label className="space-y-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Date</span>
          <input
            type="date"
            value={state.noticeDate}
            onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'noticeDate', value: e.target.value })}
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
            disabled={state.isSaving}
          />
        </label>
        <label className="space-y-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Priority</span>
          <select
            value={state.priority}
            onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'priority', value: e.target.value as NoticeItem['priority'] })}
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
            disabled={state.isSaving}
          >
            {priorityOptions.map((item) => (
              <option key={item} value={item}>{item.toUpperCase()}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="space-y-2 block">
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Announcement</span>
        <textarea
          value={state.message}
          onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'message', value: e.target.value })}
          placeholder="Write announcement details here..."
          className="w-full h-32 resize-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
          disabled={state.isSaving}
        />
      </label>
      <label className="space-y-2 block">
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Attachment (Optional)</span>
        <input
          type="file"
          onChange={(e) => dispatch({ type: 'SET_FORM_FIELD', field: 'selectedFile', value: e.target.files?.[0] || null })}
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
          disabled={state.isSaving}
        />
        {state.selectedFile && (
          <p className="text-xs font-semibold text-slate-500">Selected: {state.selectedFile.name}</p>
        )}
      </label>
      <div className="flex justify-end">
        <button type="submit" disabled={state.isSaving} className="rounded-2xl bg-brand-500 hover:bg-brand-600 text-white px-5 py-3 text-xs font-black uppercase tracking-widest disabled:opacity-60">
          {state.isSaving ? 'Publishing...' : 'Publish Notice'}
        </button>
      </div>
    </form>
  );
}
