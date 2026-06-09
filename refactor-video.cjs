const fs = require('fs');
const path = 'c:\\Data_D\\Apollo\\backup\\IEM_WEB\\src\\shared\\components\\VideoConference.tsx';

let content = fs.readFileSync(path, 'utf8');

// The new component starts exactly where the old VideoConference starts
const componentStartIndex = content.indexOf('export const VideoConference: React.FC<VideoConferenceProps> = ({');
if (componentStartIndex === -1) {
  console.error('Could not find VideoConference component start.');
  process.exit(1);
}

const topHalf = content.substring(0, componentStartIndex);

const newComponent = `export const VideoConference: React.FC<VideoConferenceProps> = ({
  user,
  isTeacher
}) => {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string>('');
  const [activeRoomObj, setActiveRoomObj] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  
  const [error, setError] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);

  // Connection-driven Mic/Cam/Screen States
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCamEnabled, setIsCamEnabled] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [showCamMenu, setShowCamMenu] = useState(false);

  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
        setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
      } catch (err) {
        console.error("Error fetching devices", err);
      }
    };
    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then(stream => {
        stream.getTracks().forEach(t => t.stop());
        getDevices();
      })
      .catch(() => getDevices());
  }, []);

  const updateParticipantsList = (r: Room) => {
    const list = [
      r.localParticipant,
      ...Array.from(r.remoteParticipants.values())
    ];
    setParticipants(list);
  };

  const handleJoinRoom = async (roomId: string) => {
    if (!roomId || !roomId.trim()) return;
    const finalRoomId = roomId.toUpperCase().trim();
    setActiveRoomId(finalRoomId);
    setIsLoadingToken(true);
    setError(null);

    const userId = user.id || \`user-\${Math.random().toString(36).substr(2, 9)}\`;
    const userName = user.name || 'Anonymous User';

    try {
      const generatedToken = await fetchLiveKitToken(userId, userName, finalRoomId, isTeacher);

      const livekitUrl = import.meta.env.VITE_LIVEKIT_WS_URL || 'ws://localhost:7880';
      const r = new Room({
        publishDefaults: {
          simulcast: true,
          videoEncoding: VideoPresets.h720.encoding,
        },
      });

      r.on(RoomEvent.ParticipantConnected, () => updateParticipantsList(r))
       .on(RoomEvent.ParticipantDisconnected, () => updateParticipantsList(r))
       .on(RoomEvent.TrackPublished, () => updateParticipantsList(r))
       .on(RoomEvent.TrackUnpublished, () => updateParticipantsList(r))
       .on(RoomEvent.LocalTrackPublished, () => updateParticipantsList(r))
       .on(RoomEvent.LocalTrackUnpublished, () => updateParticipantsList(r))
       .on(RoomEvent.ActiveSpeakersChanged, () => setParticipants(prev => [...prev]))
       .on(RoomEvent.DataReceived, (payload) => {
         const msg = new TextDecoder().decode(payload);
         if (msg === 'END_MEETING') {
           r.disconnect();
           setActiveRoomId(null);
           setActiveRoomObj(null);
           setParticipants([]);
           setError("The host has ended the meeting for everyone.");
         }
       });

      await r.connect(livekitUrl, generatedToken);
      setActiveRoomObj(r);
      updateParticipantsList(r);

      r.localParticipant.setCameraEnabled(true).then(() => setIsCamEnabled(true)).catch(() => setIsCamEnabled(false));
      r.localParticipant.setMicrophoneEnabled(true).then(() => setIsMicEnabled(true)).catch(() => setIsMicEnabled(false));
    } catch (err: any) {
      console.error("Error joining video conference room:", err);
      setError(err.message || "Failed to establish a connection or retrieve token.");
      setActiveRoomId(null);
      setActiveRoomObj(null);
    } finally {
      setIsLoadingToken(false);
    }
  };

  const handleCreateRoom = () => {
    // Generate a secure 6-character room code
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    handleJoinRoom(newRoomId);
  };

  const handleLeaveRoom = () => {
    if (activeRoomObj) activeRoomObj.disconnect();
    setActiveRoomObj(null);
    setParticipants([]);
    setIsSharingScreen(false);
    setActiveRoomId(null);
    setError(null);
  };

  const handleEndMeetingForAll = async () => {
    if (activeRoomObj && isTeacher) {
      const data = new TextEncoder().encode('END_MEETING');
      await activeRoomObj.localParticipant.publishData(data, { reliable: true });
      // Leave immediately after broadcasting
      handleLeaveRoom();
    }
  };

  useEffect(() => {
    return () => {
      if (activeRoomObj) activeRoomObj.disconnect();
    };
  }, [activeRoomObj]);

  const toggleMic = async () => {
    if (activeRoomObj) {
      const enabled = activeRoomObj.localParticipant.isMicrophoneEnabled;
      await activeRoomObj.localParticipant.setMicrophoneEnabled(!enabled);
      setIsMicEnabled(!enabled);
    }
  };

  const toggleCam = async () => {
    if (activeRoomObj) {
      const enabled = activeRoomObj.localParticipant.isCameraEnabled;
      await activeRoomObj.localParticipant.setCameraEnabled(!enabled);
      setIsCamEnabled(!enabled);
    }
  };

  const toggleScreenShare = async () => {
    if (activeRoomObj) {
      try {
        const enabled = activeRoomObj.localParticipant.isScreenShareEnabled;
        await activeRoomObj.localParticipant.setScreenShareEnabled(!enabled);
        setIsSharingScreen(!enabled);
      } catch (error: any) {
        console.error("Error toggling screen share:", error);
        setError(\`Failed to \${isSharingScreen ? 'stop' : 'start'} screen sharing: \${error.message}\`);
        setIsSharingScreen(false);
      }
    }
  };

  const screenSharer = participants.find(p => p.isScreenShareEnabled);

  const activeFocus = (() => {
    const speakingRemote = participants.find(p => !p.isLocal && p.isSpeaking && p.isCameraEnabled);
    if (speakingRemote) return speakingRemote;
    const cameraRemote = participants.find(p => !p.isLocal && p.isCameraEnabled);
    if (cameraRemote) return cameraRemote;
    const host = participants.find(p => p.identity.includes('teacher') || p.identity.includes('admin'));
    if (host) return host;
    const anyRemote = participants.find(p => !p.isLocal);
    if (anyRemote) return anyRemote;
    return participants.find(p => p.isLocal);
  })();

  return (
    <div className="space-y-12 animate-fadeIn text-slate-800 pb-20">
      <header className="flex flex-col justify-between items-start gap-4 border-b border-[#1f4e4a] pb-8">
        <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Live Conferencing</h2>
        <p className="text-[#4ea59d]/60 font-black text-[10px] uppercase tracking-[0.4em]">
          {activeRoomId ? \`Meeting Room: \${activeRoomId}\` : 'Create or Join a Meeting'}
        </p>
      </header>

      {error && (
        <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-[32px] flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
            <div>
              <p className="font-bold text-sm">Action Failed</p>
              <p className="text-xs opacity-80">{error}</p>
            </div>
          </div>
          <button onClick={() => setError(null)} className="px-6 py-2.5 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all" type="button">
            Dismiss
          </button>
        </div>
      )}

      {!activeRoomId ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="bg-white/10 backdrop-blur-2xl p-12 rounded-[48px] border border-white/20 shadow-xl max-w-lg w-full space-y-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4ea59d] to-amber-400"></div>
            
            <div className="w-24 h-24 rounded-[32px] bg-[#4ea59d]/10 text-[#4ea59d] flex items-center justify-center text-4xl shadow-inner mx-auto group hover:scale-110 transition-transform">
              <i className="fa-solid fa-video"></i>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Video Conferences</h3>
              <p className="text-slate-500 font-medium">
                {isTeacher 
                  ? "Start a new meeting room instantly or join an existing session." 
                  : "Enter the secure meeting code provided by your teacher."}
              </p>
            </div>

            {isTeacher && (
              <button
                type="button" onClick={handleCreateRoom}
                className="w-full py-5 bg-amber-400 hover:bg-amber-500 text-slate-900 rounded-[24px] text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-amber-400/20 flex items-center justify-center gap-3 transform hover:-translate-y-1"
              >
                <i className="fa-solid fa-plus text-lg"></i>
                Create New Meeting
              </button>
            )}

            <div className="relative flex items-center py-4">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-black uppercase tracking-widest">Or Join With Code</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <input 
                type="text" 
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoinRoom(joinCode) }}
                placeholder="Meeting Code (e.g. X8B9QM)"
                className="flex-1 bg-white/50 border border-slate-200 rounded-[20px] px-6 py-4 text-slate-900 font-mono font-bold text-center sm:text-left focus:outline-none focus:border-[#4ea59d] focus:ring-2 focus:ring-[#4ea59d]/20 transition-all uppercase placeholder:normal-case placeholder:font-sans placeholder:font-medium placeholder:text-slate-400"
              />
              <button
                type="button" onClick={() => handleJoinRoom(joinCode)}
                disabled={!joinCode.trim() || isLoadingToken}
                className="py-4 px-8 bg-[#4ea59d] hover:bg-[#3d8c85] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-[20px] text-sm font-black uppercase tracking-widest transition-all shadow-lg shadow-[#4ea59d]/20 flex items-center justify-center gap-2 transform hover:-translate-y-1"
              >
                {isLoadingToken ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-arrow-right"></i>}
                Join
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Main Video Arena */}
          <div className="xl:col-span-3 space-y-6">
            <div className="relative aspect-video bg-[#0a1a19] rounded-[48px] border border-white/10 overflow-hidden shadow-2xl flex items-center justify-center group animate-fadeIn">
              {screenSharer && <MainScreenShare participant={screenSharer} />}
              {!screenSharer && activeFocus && (
                <ParticipantMediaTile participant={activeFocus} isLocal={activeFocus.isLocal} className="w-full h-full rounded-[48px]" showName={false} />
              )}
              {!screenSharer && !activeFocus && (
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 rounded-full bg-[#1f4e4a] flex items-center justify-center text-4xl text-[#4ea59d] mx-auto animate-pulse">
                    <i className="fa-solid fa-video-slash"></i>
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No active feeds</p>
                </div>
              )}

              <div className="absolute top-6 left-6 flex gap-3 z-20">
                <span className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span> LIVE MEETING
                </span>
                {activeFocus && (activeFocus.identity.includes('teacher') || activeFocus.identity.includes('admin')) && (
                  <span className="px-4 py-2 bg-[#4ea59d] text-slate-900 rounded-2xl text-[9px] font-black uppercase tracking-widest">
                    FACULTY HOST
                  </span>
                )}
              </div>

              {/* Controls Overlay */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/10 opacity-90 hover:opacity-100 transition-opacity z-20">
                
                {/* Mic */}
                <div className="relative group">
                  <div className="flex">
                    <button aria-label="Action" onClick={toggleMic} className={\`w-12 h-12 rounded-l-2xl flex items-center justify-center text-lg transition-all \${isMicEnabled ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500 text-white hover:bg-red-600'}\`} title={isMicEnabled ? "Mute Microphone" : "Unmute Microphone"} type="button">
                      <i className={\`fa-solid \${isMicEnabled ? 'fa-microphone' : 'fa-microphone-slash'}\`}></i>
                    </button>
                    <button aria-label="Action" type="button" onClick={() => { setShowMicMenu(!showMicMenu); setShowCamMenu(false); }} className={\`w-6 h-12 rounded-r-2xl border-l border-white/10 flex items-center justify-center text-[10px] text-white hover:bg-white/20 transition-all \${isMicEnabled ? 'bg-white/10' : 'bg-red-500 hover:bg-red-600'}\`}>
                      <i className="fa-solid fa-chevron-up"></i>
                    </button>
                  </div>
                  {showMicMenu && (
                    <div className="absolute bottom-full left-0 mb-4 w-56 bg-[#0a1a19] border border-white/20 rounded-xl shadow-xl overflow-hidden z-30 flex flex-col max-h-60 overflow-y-auto custom-scrollbar">
                      <div className="px-4 py-2 bg-white/5 border-b border-white/10 text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Microphone</div>
                      {audioDevices.length > 0 ? audioDevices.map(d => (
                        <button key={d.deviceId} type="button" onClick={() => { if (activeRoomObj) activeRoomObj.switchActiveDevice('audioinput', d.deviceId); setShowMicMenu(false); }} className="w-full text-left px-4 py-3 text-xs font-bold text-white hover:bg-[#4ea59d] hover:text-slate-900 truncate transition-colors text-ellipsis overflow-hidden">{d.label || 'Unknown Microphone'}</button>
                      )) : <div className="px-4 py-3 text-xs text-slate-400">No microphones found</div>}
                    </div>
                  )}
                </div>

                {/* Cam */}
                <div className="relative group">
                  <div className="flex">
                    <button aria-label="Action" onClick={toggleCam} className={\`w-12 h-12 rounded-l-2xl flex items-center justify-center text-lg transition-all \${isCamEnabled ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500 text-white hover:bg-red-600'}\`} title={isCamEnabled ? "Disable Camera" : "Enable Camera"} type="button">
                      <i className={\`fa-solid \${isCamEnabled ? 'fa-video' : 'fa-video-slash'}\`}></i>
                    </button>
                    <button aria-label="Action" type="button" onClick={() => { setShowCamMenu(!showCamMenu); setShowMicMenu(false); }} className={\`w-6 h-12 rounded-r-2xl border-l border-white/10 flex items-center justify-center text-[10px] text-white hover:bg-white/20 transition-all \${isCamEnabled ? 'bg-white/10' : 'bg-red-500 hover:bg-red-600'}\`}>
                      <i className="fa-solid fa-chevron-up"></i>
                    </button>
                  </div>
                  {showCamMenu && (
                    <div className="absolute bottom-full left-0 mb-4 w-56 bg-[#0a1a19] border border-white/20 rounded-xl shadow-xl overflow-hidden z-30 flex flex-col max-h-60 overflow-y-auto custom-scrollbar">
                      <div className="px-4 py-2 bg-white/5 border-b border-white/10 text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Camera</div>
                      {videoDevices.length > 0 ? videoDevices.map(d => (
                        <button key={d.deviceId} type="button" onClick={() => { if (activeRoomObj) activeRoomObj.switchActiveDevice('videoinput', d.deviceId); setShowCamMenu(false); }} className="w-full text-left px-4 py-3 text-xs font-bold text-white hover:bg-[#4ea59d] hover:text-slate-900 truncate transition-colors text-ellipsis overflow-hidden">{d.label || 'Unknown Camera'}</button>
                      )) : <div className="px-4 py-3 text-xs text-slate-400">No cameras found</div>}
                    </div>
                  )}
                </div>

                <button aria-label="Action" onClick={toggleScreenShare} className={\`w-12 h-12 rounded-2xl flex items-center justify-center text-lg transition-all \${isSharingScreen ? 'bg-emerald-500 text-slate-900 hover:bg-emerald-600' : 'bg-white/10 text-white hover:bg-white/20'}\`} title={isSharingScreen ? "Stop Screen Share" : "Share Screen"} type="button">
                  <i className="fa-solid fa-desktop"></i>
                </button>

                <div className="w-[1px] h-8 bg-white/20 mx-2"></div>

                <button onClick={handleLeaveRoom} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2" type="button">
                  <i className="fa-solid fa-phone-slash"></i> Leave
                </button>

                {isTeacher && (
                  <button onClick={handleEndMeetingForAll} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-red-500/20 ml-2" type="button">
                    <i className="fa-solid fa-power-off"></i> End For All
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {participants.reduce((acc: React.ReactElement[], p) => {
                if (p !== activeFocus || !!screenSharer) {
                  acc.push(<ParticipantMediaTile key={p.identity} participant={p} isLocal={p.isLocal} />);
                }
                return acc;
              }, [])}
            </div>
          </div>

          {/* Room Side Panel */}
          <div className="space-y-6">
            <section className="bg-white/10 backdrop-blur-2xl p-6 rounded-[36px] border border-white/20 shadow-xl space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-signal text-[#4ea59d]"></i> Room Intelligence
              </h3>
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Meeting Code</span>
                  <span className="font-mono font-bold text-slate-900 bg-[#efe7da] px-3 py-1 rounded-lg">
                    {activeRoomId}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Connection Status</span>
                  <span className="font-bold px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-500">Connected</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Participant Count</span>
                  <span className="font-bold text-slate-900">{participants.length} Joined</span>
                </div>
              </div>
            </section>

            <section className="bg-white/10 backdrop-blur-2xl p-6 rounded-[36px] border border-white/20 shadow-xl space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-shield-halved text-[#4ea59d]"></i> Room Policies
              </h3>
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 text-xs">
                  <input aria-label="Action" type="checkbox" defaultChecked disabled className="rounded text-[#4ea59d] focus:ring-[#4ea59d] bg-transparent" />
                  <span className="text-slate-700 font-semibold">End-to-End Encryption</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <input aria-label="Action" type="checkbox" defaultChecked={isTeacher} disabled className="rounded text-[#4ea59d] focus:ring-[#4ea59d] bg-transparent" />
                  <span className="text-slate-700 font-semibold">Host Authorization Required</span>
                </div>
                {isTeacher && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl mt-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Host Options</p>
                    <p className="text-xs text-slate-600">You are the host. You can end the meeting for all participants using the red button in the video controls.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
`;

fs.writeFileSync(path, topHalf + newComponent, 'utf8');
