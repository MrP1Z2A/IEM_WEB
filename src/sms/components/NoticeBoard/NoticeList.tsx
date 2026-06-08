import React from 'react';
import { NoticeItem, priorityOptions, priorityBadgeClassMap } from './types';
import { NoticeBoardState, NoticeBoardAction } from './NoticeBoardReducer';

interface NoticeListProps {
  state: NoticeBoardState;
  dispatch: React.Dispatch<NoticeBoardAction>;
  filteredNotices: NoticeItem[];
  sortedNoticesLength: number;
  onOpenNotice: (noticeId: string) => void;
  deleteNotice: (id: string) => void;
}

export default function NoticeList({ state, dispatch, filteredNotices, sortedNoticesLength, onOpenNotice, deleteNotice }: NoticeListProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <h3 className="text-lg font-black tracking-tight">Latest Notices</h3>
        <div className="w-full sm:w-auto flex items-center gap-2">
          <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Filter Date</label>
          <input aria-label="Filter by date"
            type="date"
            value={state.filterDate}
            onChange={(e) => dispatch({ type: 'SET_FILTER_DATE', payload: e.target.value })}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-semibold"
          />
          {state.filterDate && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_FILTER_DATE', payload: '' })}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200"
            >
              Clear
            </button>
          )}
        </div>
        <div className="w-full sm:w-auto flex items-center gap-2">
          <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Priority</label>
          <select
            value={state.filterPriority}
            onChange={(e) => dispatch({ type: 'SET_FILTER_PRIORITY', payload: e.target.value as 'all' | NoticeItem['priority'] })}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-semibold"
          >
            <option value="all">ALL</option>
            {priorityOptions.map((item) => (
              <option key={item} value={item}>{item.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">
        Showing {filteredNotices.length} of {sortedNoticesLength} notices
      </p>
      {state.isLoading ? (
        <div className="rounded-[32px] border border-slate-200 bg-white dark:bg-slate-900 px-6 py-8 text-sm font-semibold text-slate-500">
          Loading notices...
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="rounded-[32px] border border-slate-200 bg-white dark:bg-slate-900 px-6 py-8 text-sm font-semibold text-slate-500">
          No notices found for the selected date.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredNotices.map((notice) => (
            <button type="button"
              key={notice.id}
              onClick={() => onOpenNotice(notice.id)}
              className="w-full text-left block rounded-[28px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-premium cursor-pointer hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{notice.notice_date}</p>
                  <h4 className="mt-2 text-xl font-black tracking-tight text-slate-900 dark:text-white">{notice.title}</h4>
                  <span className={`mt-2 inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${priorityBadgeClassMap[notice.priority]}`}>
                    {notice.priority}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteNotice(notice.id);
                  }}
                  disabled={state.deletingId === notice.id}
                  className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-black uppercase tracking-widest disabled:opacity-60"
                >
                  {state.deletingId === notice.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
              <p className="mt-4 text-xs font-black uppercase tracking-widest text-brand-500">Click to view full announcement</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
