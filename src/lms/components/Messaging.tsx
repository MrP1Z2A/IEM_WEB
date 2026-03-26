
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../src/supabaseClient';
import { Contact, Message, User } from '../types';

interface MessagingProps {
  currentUser: User;
  schoolId: string;
}

const Messaging: React.FC<MessagingProps> = ({ currentUser, schoolId }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchContacts();
  }, [schoolId]);

  useEffect(() => {
    if (activeContact) {
      fetchMessages(activeContact.id);
      
      // Subscribe to real-time messages
      // Note: Realtime filter might need adjustment if using custom IDs
      const channel = supabase
        ?.channel(`messages:${currentUser.id}:${activeContact.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${currentUser.id}`,
          },
          (payload) => {
            const msg = payload.new as Message;
            if (msg.sender_id === activeContact.id) {
              setMessages((prev) => [...prev, msg]);
              markAsRead(msg.id);
            }
          }
        )
        .subscribe();

      return () => {
        if (channel) supabase?.removeChannel(channel);
      };
    }
  }, [activeContact, currentUser.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchContacts = async () => {
    if (!supabase) return;
    setIsLoadingContacts(true);
    try {
      // Fetch Teachers
      const { data: teachers, error: tError } = await supabase
        .from('teachers')
        .select('id, name, email, avatar')
        .eq('school_id', schoolId);

      // Fetch Peers (students in the same school)
      const { data: students, error: sError } = await supabase
        .from('students')
        .select('id, name, email, avatar')
        .eq('school_id', schoolId)
        .neq('id', currentUser.id);

      // Fetch Student Services
      const { data: services, error: svError } = await supabase
        .from('student_services')
        .select('id, name, email, avatar')
        .eq('school_id', schoolId);

      const allContacts: Contact[] = [
        ...(teachers?.map(t => ({ ...t, auth_user_id: t.id, role: 'teacher' as const })) || []),
        ...(students?.map(s => ({ ...s, auth_user_id: s.id, role: 'student' as const })) || []),
        ...(services?.map(sv => ({ ...sv, auth_user_id: sv.id, role: 'student_service' as const })) || []),
      ];

      setContacts(allContacts);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const fetchMessages = async (contactId: string) => {
    if (!supabase) return;
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeContact || !supabase) return;

    const messageData = {
      sender_id: currentUser.id,
      receiver_id: activeContact.id,
      content: newMessage.trim(),
      school_id: schoolId,
    };

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([messageData])
        .select()
        .single();

      if (error) throw error;
      setMessages((prev) => [...prev, data]);
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const markAsRead = async (messageId: string) => {
    if (!supabase) return;
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId);
  };

  return (
    <div className="flex bg-[#0a1a19]/40 backdrop-blur-2xl rounded-[40px] border border-white/20 h-[700px] overflow-hidden shadow-2xl animate-in fade-in duration-500">
      {/* Sidebar: Contact List */}
      <div className="w-80 border-r border-white/10 flex flex-col bg-[#0a1a19]/60">
        <div className="p-8 border-b border-white/10">
          <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <i className="fa-solid fa-comments text-[#4ea59d]"></i> Messages
          </h3>
          <div className="mt-4 relative">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
            <input 
              type="text" 
              placeholder="Search contacts..." 
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-[#4ea59d] transition-all"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
          {isLoadingContacts ? (
             <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
               <div className="w-8 h-8 border-4 border-[#4ea59d] border-t-transparent rounded-full animate-spin"></div>
               <p className="text-[10px] font-black uppercase tracking-widest text-[#4ea59d]">Loading contacts...</p>
             </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs text-slate-500 font-bold">No contacts found</p>
            </div>
          ) : (
            contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setActiveContact(contact)}
                className={`w-full p-4 rounded-3xl flex items-center gap-4 transition-all group ${
                  activeContact?.id === contact.id 
                    ? 'bg-[#4ea59d] text-white shadow-lg shadow-[#4ea59d]/20' 
                    : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                <div className="relative">
                  <img 
                    src={contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=4ea59d&color=fff`} 
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-white/10" 
                    alt={contact.name}
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0a1a19]"></div>
                </div>
                <div className="flex-1 text-left overflow-hidden">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-black truncate">{contact.name}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black uppercase tracking-widest ${activeContact?.id === contact.id ? 'text-white/80' : 'text-[#4ea59d]'}`}>
                      {contact.role}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {activeContact ? (
          <>
            {/* Chat Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#0a1a19]/20">
              <div className="flex items-center gap-4">
                <img 
                  src={activeContact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeContact.name)}&background=4ea59d&color=fff`} 
                  className="w-10 h-10 rounded-xl" 
                  alt={activeContact.name}
                />
                <div>
                  <h4 className="text-sm font-black text-white">{activeContact.name}</h4>
                  <p className="text-[10px] text-[#4ea59d] font-black uppercase tracking-widest">{activeContact.role}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button title="View Profile Info" className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                  <i className="fa-solid fa-circle-info"></i>
                </button>
              </div>
            </div>

            {/* Message Feed */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-8 h-8 border-4 border-[#4ea59d] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-20">
                  <i className="fa-solid fa-message text-6xl mb-4"></i>
                  <p className="text-sm font-black uppercase tracking-[0.2em]">Start a conversation</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_id === currentUser.id;
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                      <div className={`max-w-[70%] space-y-1`}>
                        <div className={`p-4 rounded-3xl text-sm leading-relaxed ${
                          isOwn 
                            ? 'bg-[#4ea59d] text-white rounded-tr-none shadow-lg shadow-[#4ea59d]/10' 
                            : 'bg-white/5 text-slate-200 border border-white/10 rounded-tl-none'
                        }`}>
                          {msg.content}
                        </div>
                        <p className={`text-[8px] font-black uppercase tracking-widest text-slate-500 ${isOwn ? 'text-right' : 'text-left'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isOwn && msg.read_at && <i className="fa-solid fa-check-double text-[#4ea59d] ml-1"></i>}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-8 bg-[#0a1a19]/40 border-t border-white/10">
              <form onSubmit={handleSendMessage} className="flex gap-4">
                <div className="flex-1 relative">
                  <button type="button" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#4ea59d] transition-colors">
                    <i className="fa-solid fa-paperclip"></i>
                  </button>
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..." 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-[#4ea59d] transition-all"
                  />
                  <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#4ea59d] transition-colors">
                    <i className="fa-regular fa-face-smile"></i>
                  </button>
                </div>
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="w-14 h-14 bg-[#4ea59d] text-white rounded-2xl flex items-center justify-center hover:bg-[#3d8c85] transition-all shadow-lg shadow-[#4ea59d]/20 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <i className="fa-solid fa-paper-plane group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"></i>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-40 mix-blend-overlay">
            <div className="w-32 h-32 bg-[#4ea59d]/20 rounded-[40px] flex items-center justify-center text-[60px] text-[#4ea59d] mb-8 animate-pulse">
              <i className="fa-solid fa-comments"></i>
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-[0.3em]">Select a contact</h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">To start your communication journey</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messaging;
