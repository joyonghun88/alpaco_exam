import { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, AlertOctagon, ChevronLeft, ChevronRight, CheckCircle2, Monitor, ShieldCheck, Download, Columns } from 'lucide-react';
import { io } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SignalingClient, Role } from 'amazon-kinesis-video-streams-webrtc';
import { API_BASE_URL, SOCKET_URL } from '../../config';

interface Question {
  id: string;
  type: string;
  content: { text: string, options: string[], passage?: string };
  orderNum: number;
  point: number;
}

export default function Sandbox() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  
  const [showGuide, setShowGuide] = useState(true);
  const [isWarningBlocked, setIsWarningBlocked] = useState(false);
  const [socketInst, setSocketInst] = useState<any>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const isSubmittingRef = useRef(false);
  const showGuideRef = useRef(showGuide);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const signalingClientRef = useRef<SignalingClient | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const participantId = sessionStorage.getItem('participantId') || '';

  // showGuideRef 동기화
  useEffect(() => {
    showGuideRef.current = showGuide;
  }, [showGuide]);

  // 1. 초기 데이터 로드 및 로컬 복구
  useEffect(() => {
    if (!participantId) {
      alert('비정상적인 접근입니다.');
      window.location.href = '/exam';
      return;
    }

    // 문제 데이터 패치
    fetch(`${API_BASE_URL}/exam/${participantId}/questions`)
      .then(res => res.json())
      .then(data => {
        setQuestions(data);
        // 로컬 스토리지 데이터 복구 시도
        const saved = localStorage.getItem(`answers_${participantId}`);
        if (saved) {
          setAnswers(JSON.parse(saved));
        }
      });

    // 타이머 설정
    const startTimeStr = sessionStorage.getItem('startedAt');
    const durationMinStr = sessionStorage.getItem('durationMinutes');
    if (startTimeStr && durationMinStr) {
       const start = new Date(startTimeStr).getTime();
       const duration = parseInt(durationMinStr) * 60;
       const elapsed = Math.floor((Date.now() - start) / 1000);
       const remaining = duration - elapsed;
       setTimeLeft(remaining > 0 ? remaining : 0);
    }

    const socket = io(SOCKET_URL);
    setSocketInst(socket);

    const timerInt = setInterval(() => {
      setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);

    // 보안 감지 이벤트
    const handleBlur = () => {
      if (isSubmittingRef.current || showGuideRef.current) return;
      setIsWarningBlocked(true);
      socket.emit('report_violation', { participantId, type: 'BLUR_SCREEN_OUT' });
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !isSubmittingRef.current && !showGuideRef.current) {
        setIsWarningBlocked(true);
        socket.emit('report_violation', { participantId, type: 'EXIT_FULLSCREEN' });
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      clearInterval(timerInt);
      clearTimeout(reconnectTimeoutRef.current);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      socket.disconnect();
      stopStreaming();
    };
  }, [participantId]);

  // 2. KVS 스트리밍 및 자동 재연결 로직
  const startStreaming = useCallback(async (isRetry = false) => {
    if (signalingClientRef.current && !isRetry) return;

    try {
      const res = await fetch(`${API_BASE_URL}/exam/${participantId}/kvs-credentials`);
      const creds = await res.json();

      const signalingClient = new SignalingClient({
        channelARN: creds.channelArn,
        region: creds.region,
        role: Role.MASTER,
        credentials: {
          accessKeyId: creds.accessKeyId,
          secretAccessKey: creds.secretAccessKey,
          sessionToken: creds.sessionToken,
        },
      } as any);

      const peerConnectionsByClientId: Record<string, RTCPeerConnection> = {};

      (signalingClient as any).on('open', () => {
        console.log('[KVS Master] Connected to signaling');
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      });

      (signalingClient as any).on('sdpOffer', async (offer: any, remoteClientId: string) => {
        console.log('[KVS Master] Received offer from viewer:', remoteClientId);
        
        const iceServers = (creds.iceServers && creds.iceServers.length > 0) 
          ? creds.iceServers 
          : [{ urls: `stun:stun.kinesisvideo.${creds.region}.amazonaws.com:443` }];

        const peerConnection = new RTCPeerConnection({ iceServers });
        peerConnectionsByClientId[remoteClientId] = peerConnection;

        // 로컬 트랙 추가
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
            peerConnection.addTrack(track, streamRef.current!);
          });
        }

        peerConnection.onicecandidate = ({ candidate }) => {
          if (candidate) {
            (signalingClient as any).sendIceCandidate(candidate, remoteClientId);
          }
        };

        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        (signalingClient as any).sendSdpAnswer(peerConnection.localDescription as any, remoteClientId);
      });

      (signalingClient as any).on('iceCandidate', async (candidate: any, remoteClientId: string) => {
        const pc = peerConnectionsByClientId[remoteClientId];
        if (pc) await pc.addIceCandidate(candidate);
      });

      (signalingClient as any).on('close', () => {
        console.warn('[KVS Master] Disconnected. Retrying in 5s...');
        reconnectTimeoutRef.current = setTimeout(() => startStreaming(true), 5000);
      });

      (signalingClient as any).on('error', (err: any) => {
        console.error('[KVS Master] Error:', err);
      });

      signalingClientRef.current = signalingClient;
      signalingClient.open();
    } catch (err) {
      console.error('[KVS Master] Stream Init Failed', err);
    }
  }, [participantId]);

  const stopStreaming = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (signalingClientRef.current) signalingClientRef.current.close();
  };

  // 3. 시험 시작 핸들러
  const handleStartExam = async () => {
    try {
      if (sessionStorage.getItem('isRequireCamera') === 'true') {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        startStreaming();
      }
      
      // 전체화면 시도
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setShowGuide(false);
    } catch (err) {
      alert('평가 환경 구축에 실패했습니다. 카메라 권한을 확인해주세요.');
    }
  };

  // 4. 답안 선택 및 자동 저장 (LocalStorage + API)
  const handleOptionSelect = async (qId: string, optIndex: number) => {
    const newAnswers = { ...answers, [qId]: optIndex };
    setAnswers(newAnswers);
    
    // 로컬 저장 (즉시)
    localStorage.setItem(`answers_${participantId}`, JSON.stringify(newAnswers));

    // 백엔드 동기화 (비동기)
    setIsSyncing(true);
    try {
      await fetch(`${API_BASE_URL}/exam/${participantId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: qId, answer: optIndex })
      });
    } catch (e) {
      console.error('Progress sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmit = async () => {
    isSubmittingRef.current = true;
    if (!window.confirm("정말로 평가를 최종 제출하시겠습니까?")) {
      isSubmittingRef.current = false;
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE_URL}/exam/${participantId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      });
      if (res.ok) {
        localStorage.removeItem(`answers_${participantId}`);
        setIsSubmitted(true);
        if (socketInst) socketInst.emit('admin_update', { event: 'SUBMITTED' });
        if (document.fullscreenElement) document.exitFullscreen();
      }
    } catch(e) {
      isSubmittingRef.current = false;
      alert("제출 실패. 연결 확인 후 다시 시도해주세요.");
    }
  };

  if (isSubmitted) {
     return (
       <div className="min-h-screen bg-atomic-navy-900 flex flex-col items-center justify-center text-white p-10 text-center">
         <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-10 border border-emerald-500/30">
            <CheckCircle2 size={48} className="text-emerald-500" />
         </div>
         <h1 className="text-4xl font-black mb-4">평가가 정상적으로 제출되었습니다.</h1>
         <p className="text-atomic-gray-400 text-lg mb-8">모든 응시 데이터와 모니터링 로그가 안전하게 저장되었습니다.<br/>브라우저 창을 닫고 퇴실해 주세요.</p>
         <button onClick={() => window.close()} className="px-10 py-4 bg-bg-section border border-button-outline rounded-2xl font-black hover:bg-atomic-navy-700 transition-all">나가기</button>
       </div>
     );
  }

  // 5. 로딩 UI
  if (questions.length === 0) return (
    <div className="min-h-screen bg-atomic-navy-900 flex flex-col justify-center items-center">
       <div className="w-16 h-16 border-4 border-ai-accent/20 border-t-ai-accent rounded-full animate-spin mb-6" />
       <div className="text-ai-accent font-black tracking-widest uppercase">Initializing Testing Sandbox...</div>
    </div>
  );

  const currentQ = questions[currentQIndex];
  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round((answeredCount / questions.length) * 100);

  // 남은 시간에 따른 색상 로직
  const timerColor = timeLeft < 60 ? 'text-red-500 animate-pulse' : timeLeft < 300 ? 'text-yellow-400' : 'text-ai-accent';

  return (
    <div className="min-h-screen bg-atomic-navy-900 text-atomic-gray-50 flex flex-col overflow-hidden select-none">
      
      {/* 사전 가이드 모달 */}
      {showGuide && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
           <div className="bg-[#041433] w-full max-w-3xl rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/5">
                 <div className="flex items-center space-x-3">
                    <Monitor size={24} className="text-primary" />
                    <h2 className="text-2xl font-black text-white">수험생 평가 가이드 및 유의사항</h2>
                 </div>
                 <div className="px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-black text-primary uppercase">Alpha Build v2.4</div>
              </div>
              <div className="p-10 space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                       <div className="flex items-center space-x-3 mb-4">
                          <ShieldCheck size={20} className="text-emerald-500" />
                          <span className="font-black text-sm text-white uppercase">Identity & Security</span>
                       </div>
                       <ul className="text-xs space-y-3 font-medium text-atomic-gray-400 leading-relaxed">
                          <li>• 카메라를 통한 실시간 AI 감독이 진행됩니다.</li>
                          <li>• 시험 도중 마스크 착용이나 모자 착용을 금합니다.</li>
                          <li>• 정면 응시가 아닐 경우 경고가 발생할 수 있습니다.</li>
                       </ul>
                    </div>
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                       <div className="flex items-center space-x-3 mb-4">
                          <AlertOctagon size={20} className="text-red-500" />
                          <span className="font-black text-sm text-white uppercase">Prohibited Actions</span>
                       </div>
                       <ul className="text-xs space-y-3 font-medium text-atomic-gray-400 leading-relaxed">
                          <li>• 전체화면 이탈 시 부정행위로 즉시 기록됩니다.</li>
                          <li>• 듀얼 모니터 사용은 절대 금지되어 있습니다.</li>
                          <li>• 개발자 도구 시도 시 즉시 퇴실 조치됩니다.</li>
                       </ul>
                    </div>
                 </div>
                 <div className="p-6 bg-primary/5 border border-primary/20 rounded-3xl">
                    <div className="flex items-center space-x-3 mb-3">
                       <Download size={18} className="text-primary" />
                       <span className="text-sm font-black text-primary">Auto-Save Technology Enabled</span>
                    </div>
                    <p className="text-xs text-atomic-gray-300 font-bold">네트워크 장애가 발생하더라도 모든 답변은 로컬과 서버에 실시간 동기화되어 안전하게 보호됩니다.</p>
                 </div>
              </div>
              <div className="p-10 pt-0">
                 <button 
                  onClick={handleStartExam}
                  className="w-full py-5 bg-primary text-white rounded-2xl font-black text-xl shadow-xl shadow-primary/30 hover:scale-[1.02] transition-transform active:scale-95"
                 >
                    유의사항 확인 및 시험 시작
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* 헤더 */}
      <header className="h-16 bg-[#041433] border-b border-atomic-navy-600 px-8 flex items-center justify-between z-50">
        <div className="flex items-center space-x-6">
           <img src="/alpaco-logo.png" alt="ALPACO" className="h-4 opacity-80" />
           <div className="h-4 w-[1px] bg-atomic-navy-600" />
           <h1 className="text-sm font-black text-white tracking-widest uppercase pb-[1px]">ALPACO SECURE SANDBOX</h1>
        </div>
        
        <div className="flex items-center space-x-6">
           {isSyncing && <div className="flex items-center space-x-2 text-[10px] font-black text-ai-accent animate-pulse uppercase"><Download size={12}/> <span>Syncing...</span></div>}
           <div className={`flex items-center space-x-3 bg-black/40 px-6 py-2 rounded-xl border-2 ${timeLeft < 60 ? 'border-red-500' : 'border-atomic-navy-600'}`}>
              <Clock size={18} className={timerColor} />
              <span className={`font-mono text-xl font-black tracking-tighter ${timerColor}`}>
                 {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
           </div>
           <button onClick={handleSubmit} className="bg-primary hover:bg-ai-accent hover:text-primary-strong text-white px-8 py-2.5 rounded-xl font-black text-sm transition-all shadow-lg shadow-primary/20">
             최종 제출
           </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* 사이드바 - 문항 네비게이터 */}
        <aside className="w-80 bg-[#082250] border-r border-atomic-navy-600 flex flex-col">
           <div className="p-8 border-b border-atomic-navy-600">
              <div className="flex items-center justify-between mb-4">
                 <span className="text-[10px] font-black text-atomic-gray-400 uppercase">Progress</span>
                 <span className="text-xs font-black text-ai-accent">{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                 <div className="h-full bg-ai-accent transition-all duration-700 ease-out" style={{width: `${progressPercent}%`}} />
              </div>
           </div>

           {/* 카메라 피드 */}
           {sessionStorage.getItem('isRequireCamera') === 'true' && (
             <div className="p-6 border-b border-atomic-navy-600">
                <div className="relative aspect-video rounded-3xl overflow-hidden ring-2 ring-white/5 shadow-2xl">
                   <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                   <div className="absolute top-4 left-4 flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest drop-shadow-md">Live Stream</span>
                   </div>
                </div>
             </div>
           )}

           <div className="flex-1 overflow-y-auto p-6 grid grid-cols-4 gap-3 content-start scroll-smooth">
              {questions.map((q, idx) => (
                <button 
                  key={q.id}
                  onClick={() => setCurrentQIndex(idx)}
                  className={`
                    h-12 rounded-xl flex items-center justify-center font-black text-sm transition-all
                    ${currentQIndex === idx 
                      ? 'bg-ai-accent text-primary-strong shadow-lg scale-110 ring-4 ring-ai-accent/20' 
                      : answers[q.id] !== undefined 
                        ? 'bg-primary text-white'
                        : 'bg-black/20 text-atomic-gray-400 border border-white/5 hover:bg-white/5'}
                  `}
                >
                  {q.orderNum}
                </button>
              ))}
           </div>
        </aside>

        {/* 메인 풀이 영역 (Split View) */}
        <main className="flex-1 flex flex-col bg-atomic-navy-900 relative">
           
           {/* 고정 경고 레이어 */}
           {isWarningBlocked && (
             <div className="absolute inset-0 z-[150] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-12 text-center overflow-hidden animate-in fade-in duration-300">
                <div className="w-32 h-32 bg-red-500/20 rounded-full flex items-center justify-center mb-10 border border-red-500/30 animate-bounce">
                   <AlertOctagon size={64} className="text-red-500" />
                </div>
                <h2 className="text-5xl font-black text-white mb-6 uppercase tracking-tighter">화면 이탈이 감지되었습니다!</h2>
                <p className="text-atomic-gray-400 max-w-2xl text-xl font-medium leading-relaxed mb-12">
                   온라인 실시간 감독 시스템에 의해 비정상적인 접근이 감지되었습니다.<br/>
                   본 위반 사항은 감독관 대시보드 및 영상 클립에 자동 저장됩니다.
                </p>
                <button 
                  onClick={() => { setIsWarningBlocked(false); if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }}
                  className="px-12 py-5 bg-red-600 text-white rounded-3xl font-black text-2xl hover:bg-red-700 transition-all shadow-2xl shadow-red-600/30 active:scale-95"
                >
                   전체화면으로 복귀
                </button>
             </div>
           )}

           <div className="flex-1 flex overflow-hidden">
              {/* [좌측] 연계 지문 영역 (있는 경우에만 표시) */}
              {currentQ.content.passage && (
                <section className="flex-1 border-r border-atomic-navy-600 bg-black/20 overflow-y-auto p-12 scroll-smooth leading-relaxed">
                   <div className="max-w-3xl mx-auto space-y-8">
                      <div className="flex items-center space-x-3 text-ai-accent opacity-60">
                         <Columns size={18} />
                         <span className="text-xs font-black uppercase tracking-widest">Question Passage</span>
                      </div>
                      <div className="prose prose-invert prose-lg max-w-none text-atomic-gray-100 font-medium leading-[2] md-preview">
                         <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={(url) => url.startsWith('http') || url.startsWith('data:') ? url : `${API_BASE_URL}${url}`}>{currentQ.content.passage}</ReactMarkdown>
                      </div>
                   </div>
                </section>
              )}

              {/* [우측] 문제 영역 */}
              <section className={`flex-1 overflow-y-auto p-12 scroll-smooth ${currentQ.content.passage ? 'bg-black/5' : ''}`}>
                 <div className="max-w-3xl mx-auto">
                    <div className="flex items-center space-x-3 mb-12">
                       <span className="px-5 py-2 bg-primary/10 border border-primary/20 text-primary rounded-2xl text-sm font-black uppercase tracking-tighter">
                          Q.{currentQ.orderNum} <span className="opacity-40">ITEM</span>
                       </span>
                       <span className="text-xs font-bold text-atomic-gray-400">배점 {currentQ.point}pt</span>
                    </div>

                    <h2 className="text-3xl font-black text-white leading-tight mb-12">
                       {currentQ.content.text}
                    </h2>

                    <div className="space-y-4 mb-24">
                       {currentQ.content.options.map((opt, idx) => {
                          const isSelected = answers[currentQ.id] === idx;
                          return (
                            <button 
                              key={idx}
                              onClick={() => handleOptionSelect(currentQ.id, idx)}
                              className={`
                                w-full text-left p-8 rounded-3xl border-2 flex items-center space-x-6 transition-all group
                                ${isSelected 
                                  ? 'bg-primary text-white border-ai-accent shadow-2xl shadow-primary/20 scale-[1.02]' 
                                  : 'bg-white/5 border-white/10 hover:border-primary hover:bg-white/[0.08]'}
                              `}
                            >
                               <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                                  ${isSelected ? 'border-primary bg-ai-accent text-primary-strong' : 'border-white/20 text-white group-hover:border-primary'}
                               `}>
                                  <span className="text-xs font-black">{idx + 1}</span>
                               </div>
                               <span className={`text-xl font-bold ${isSelected ? 'text-white' : 'text-atomic-gray-300'}`}>
                                  {opt}
                               </span>
                            </button>
                          );
                       })}
                    </div>
                 </div>
              </section>
           </div>

           {/* 하단 내비게이션 */}
           <footer className="h-24 bg-[#041433] border-t border-atomic-navy-600 px-10 flex items-center justify-between">
              <button 
                onClick={() => setCurrentQIndex(prev => Math.max(0, prev-1))}
                className={`flex items-center space-x-3 py-3 px-6 rounded-2xl transition-all ${currentQIndex === 0 ? 'opacity-20 pointer-events-none' : 'hover:bg-white/5 text-white'}`}
              >
                <ChevronLeft size={24} />
                <span className="text-lg font-black">이전 문항</span>
              </button>
              
              <div className="hidden md:flex flex-col items-center">
                 <div className="flex space-x-1">
                    {questions.map((_, i) => (
                       <div key={i} className={`h-1 rounded-full transition-all ${i === currentQIndex ? 'w-8 bg-ai-accent' : 'w-2 bg-white/10'}`} />
                    ))}
                 </div>
                 <span className="text-[10px] font-black text-atomic-gray-500 mt-2 uppercase tracking-widest">{currentQIndex + 1} OF {questions.length} ITEM</span>
              </div>

              <button 
                onClick={() => {
                  if (currentQIndex < questions.length - 1) setCurrentQIndex(prev => prev+1);
                  else handleSubmit();
                }}
                className="flex items-center space-x-4 bg-primary text-white py-4 px-12 rounded-3xl font-black text-xl hover:bg-ai-accent hover:text-primary-strong transition-all shadow-xl active:scale-95"
              >
                <span>{currentQIndex < questions.length - 1 ? '정답 저장 후 다음' : '평가 완료 및 제출'}</span>
                <ChevronRight size={24} />
              </button>
           </footer>
        </main>
      </div>
    </div>
  );
}
