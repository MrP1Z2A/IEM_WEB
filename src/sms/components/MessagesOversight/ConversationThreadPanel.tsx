import React from 'react';
import { ConversationSummary, MessageRecord, UserProfile } from '../MessagesOversight';

interface ConversationThreadPanelProps {
  activeConv: ConversationSummary | null;
  convMessages: MessageRecord[];
  getUserName: (id: string) => string;
  getUserAvatar: (id: string) => string;
  userMap: Record<string, UserProfile>;
  onClose: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ConversationThreadPanel: React.FC<ConversationThreadPanelProps> = ({
  activeConv,
  convMessages,
  getUserName,
  getUserAvatar,
  userMap,
  onClose,
  messagesEndRef,
}) => {
  if (!activeConv) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center opacity-30">
        <div className="w-24 h-24 rounded-[32px] bg-brand-500/10 flex items-center justify-center text-5xl text-brand-500 mb-6">
          <i className="fas fa-comments"></i>
        </div>
        <h3 className="text-xl font-black text-slate-700 dark:text-white uppercase tracking-wide">Select a conversation</h3>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">to view the full message thread</p>
      </div>
    );
  }

  return (
    <>
      {/* Thread Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3">
          {activeConv.kind === 'group' ? (
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <i className="fas fa-users text-indigo-500"></i>
            </div>
          ) : (
            <div className="flex -space-x-2">
              {activeConv.participantAvatars.slice(0, 2).map((av, i) => (
                <img key={i} src={av} className="w-9 h-9 rounded-xl object-cover border-2 border-white dark:border-slate-900" alt="" />
              ))}
            </div>
          )}
          <div>
            <h4 className="text-sm font-black text-slate-800 dark:text-white">{activeConv.name}</h4>
            <p className="text-[10px] text-slate-400 font-bold">
              {activeConv.kind === 'group'
                ? `${activeConv.participantNames.length} members · ${activeConv.messageCount} messages`
                : `${activeConv.messageCount} messages`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeConv.kind === 'group' && (
            <div className="text-right hidden md:block">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Members</p>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                {activeConv.participantNames.join(', ')}
              </p>
            </div>
          )}
          <button onClick={onClose}
            aria-label="Close conversation thread"
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all" type="button">
            <i className="fas fa-xmark text-sm"></i>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {convMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-30">
            <i className="fas fa-message text-4xl mb-3 text-slate-400"></i>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">No messages</p>
          </div>
        ) : (
          convMessages.map(msg => {
            const senderName = getUserName(msg.sender_id);
            const senderAvatar = getUserAvatar(msg.sender_id);
            const senderUser = userMap[msg.sender_id];

            return (
              <div key={msg.id} className="flex items-start gap-3 group">
                <img src={senderAvatar} className="w-8 h-8 rounded-lg object-cover shrink-0 mt-0.5" alt={senderName} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black text-slate-700 dark:text-white">{senderName}</span>
                    {senderUser && (
                      <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                        senderUser.role === 'teacher' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' :
                        senderUser.role === 'student_service' ? 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400' :
                        senderUser.role === 'parent' ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' :
                        'bg-brand-500/10 text-brand-600'
                      }`}>{senderUser.role.replace('_', ' ')}</span>
                    )}
                    <span className="text-[9px] font-bold text-slate-400">
                      {new Date(msg.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.read_at && (
                      <span className="text-[8px] text-brand-500 font-bold flex items-center gap-0.5">
                        <i className="fas fa-check-double"></i>
                      </span>
                    )}
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl rounded-tl-sm px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 max-w-xl border border-slate-100 dark:border-slate-700">
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Read-only notice */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <div className="flex flex-col gap-2 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl">
          <div className="flex items-center gap-3">
            <i className="fas fa-shield-halved text-amber-500 text-sm"></i>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Administrative Policy: Secure Observation Active
            </p>
          </div>
          <p className="text-[9px] font-bold text-amber-700/70 dark:text-amber-500/50 ml-7 leading-relaxed">
            This session is being recorded for administrative audit. All access to student-teacher communication is logged. Messages in this view are read-only.
          </p>
        </div>
      </div>
    </>
  );
};
