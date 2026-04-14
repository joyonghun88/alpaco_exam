import React, { useState, useEffect, useRef } from 'react';
import { Users, Timer, ShieldAlert, CheckCircle, RefreshCcw, LayoutGrid, ChevronRight, ArrowLeft, Activity, Monitor, AlertTriangle, Building2, Download, Target, Cpu, BookOpen, Video, X, VideoOff, ShieldCheck } from 'lucide-react';
import { SignalingClient, Role } from 'amazon-kinesis-video-streams-webrtc';
import { API_BASE_URL } from '../../config';

interface RoomSummary {
  id: string;
  roomName: string;
  examTitle: string;
  status: string;
  startAt: string;
  endAt: string;
  stats: { total: number; testing: number; completed: number; violations: number };
  waitingMessage?: string;
  waitingTitle?: string;
  iconType?: string;
  isRequireCamera?: boolean;
  standardTerms?: string;
  cameraTerms?: string;
}

interface SecurityLog {
  id: string;
  violationType: string;
  capturedAt: string;
  clipUrl?: string;
}

interface Participant {
  id: string; name: string; email: string; roomName: string; status: string;
  startedAt: string | null; violationCount: number;
  totalScore: number;
  questionResults: { questionId: string, orderNum: number, point: number, earnedPoint: number, gradingStatus: string }[];
  securityLogs: SecurityLog[];
  videoUrl?: string;
}

const VIOLATION_MAP: Record<string, string> = {
  'BLUR_SCREEN_OUT': '화면 이탈 (다른 창/탭 이동)',
  'EXIT_FULLSCREEN': '전체화면 모드 종료',
  'DEVTOOLS_OPEN': '개발자 도구 시도',
  'KEYBOARD_RESTRICTED': '제한된 특수키 사용'
};

// KVS 실시간 뷰어 컴포넌트
function KvsViewer({ participantId, onClose }: { participantId: string, onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('초기화 중...');

  useEffect(() => {
    let signalingClient: any;

    async function startViewer() {
      try {
        setStatus('자격증명 확인...');
        const res = await fetch(`${API_BASE_URL}/exam/${participantId}/kvs-credentials`);
        const creds = await res.json();

        signalingClient = new SignalingClient({
          channelARN: creds.channelArn, 
          region: creds.region, 
          role: Role.VIEWER,
          clientId: `admin-${Math.random().toString(36).substring(2, 9)}`,
          endpoint: creds.signalingEndpoint,
          credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey, sessionToken: creds.sessionToken },
        } as any);

        const iceServers = (creds.iceServers && creds.iceServers.length > 0)
          ? creds.iceServers
          : [{ urls: `stun:stun.kinesisvideo.${creds.region}.amazonaws.com:443` }];

        const peerConnection = new RTCPeerConnection({ iceServers });

        peerConnection.onicecandidate = ({ candidate }) => {
          if (candidate) {
            signalingClient.sendIceCandidate(candidate);
          }
        };

        signalingClient.on('open', async () => {
          console.log('[KVS Admin] Viewer signaling opened');
          setStatus('수렴자 기기 연결 요청...');
          setLoading(false);
          peerConnection.addTransceiver('video', { direction: 'recvonly' });
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          signalingClient.sendSdpOffer(peerConnection.localDescription as any);
        });

        signalingClient.on('sdpAnswer', async (answer: any) => {
          setStatus('수험생 기기 응답함, 연결 처리...');
          await peerConnection.setRemoteDescription(answer);
        });

        signalingClient.on('iceCandidate', (candidate: any) => {
          peerConnection.addIceCandidate(candidate);
        });

        peerConnection.ontrack = (event) => {
          setStatus('연결 성공: LIVE');
          if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
          }
        };

        signalingClient.on('error', (err: any) => {
           setStatus('연결 에러');
           console.error(err);
        });

        signalingClient.open();
      } catch (err: any) {
        setStatus(`에러: ${err.message}`);
        console.error('Failed to start KvsViewer', err);
      }
    }

    startViewer();
    return () => signalingClient?.close();
  }, [participantId]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-10">
      <div className="bg-bg-default w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-2xl relative border border-white/20">
         <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-red-100 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all z-20">
            <X size={24} />
         </button>
         <div className="p-8 border-b border-button-outline flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${status === '연결 성공: LIVE' ? 'bg-green-500' : 'bg-ai-accent animate-pulse'}`} />
            <h3 className="text-xl font-black text-text-title uppercase tracking-tighter">Live Monitor: {status}</h3>
         </div>
         <div className="relative aspect-video bg-black flex items-center justify-center">
            {loading && <div className="text-white font-black animate-pulse">{status}</div>}
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
         </div>
         <div className="p-6 bg-bg-section/50 flex justify-between items-center">
            <p className="text-xs font-bold text-text-caption">응시자 ID: {participantId}</p>
            <div className="flex items-center space-x-2 text-[10px] font-black text-primary uppercase">
               <Activity size={12} />
               <span>High Latency Optimized</span>
            </div>
         </div>
      </div>
    </div>
  );
}

// KVS 소형 뷰어 아이템 (모자이크용)
function KvsViewerItem({ participantId }: { participantId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('대기');

  useEffect(() => {
    let signalingClient: any;
    async function init() {
      try {
        const res = await fetch(`${API_BASE_URL}/exam/${participantId}/kvs-credentials`);
        const creds = await res.json();
        signalingClient = new SignalingClient({
          channelARN: creds.channelArn, 
          region: creds.region, 
          role: Role.VIEWER,
          clientId: `admin-${Math.random().toString(36).substring(2, 9)}`,
          endpoint: creds.signalingEndpoint,
          credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey, sessionToken: creds.sessionToken },
        } as any);
        
        const iceServers = (creds.iceServers && creds.iceServers.length > 0)
          ? creds.iceServers
          : [{ urls: `stun:stun.kinesisvideo.${creds.region}.amazonaws.com:443` }];

        const peerConnection = new RTCPeerConnection({ iceServers });
        
        peerConnection.onicecandidate = ({ candidate }) => {
          if (candidate) signalingClient.sendIceCandidate(candidate);
        };

        signalingClient.on('open', async () => {
          setStatus('요청');
          peerConnection.addTransceiver('video', { direction: 'recvonly' });
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          signalingClient.sendSdpOffer(peerConnection.localDescription as any);
        });
        signalingClient.on('sdpAnswer', async (answer: any) => {
          setStatus('연결');
          peerConnection.setRemoteDescription(answer);
        });
        signalingClient.on('iceCandidate', (cad: any) => peerConnection.addIceCandidate(cad));
        peerConnection.ontrack = (ev) => { 
           setStatus('LIVE');
           if (videoRef.current) videoRef.current.srcObject = ev.streams[0]; 
        };
        signalingClient.open();
      } catch {}
    }
    init();
    return () => signalingClient?.close();
  }, [participantId]);

  return (
    <div className="bg-black rounded-2xl overflow-hidden aspect-video relative border border-white/5 group">
       <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
       <div className="absolute top-2 left-2 flex items-center space-x-1">
          <div className={`w-1.5 h-1.5 rounded-full ${status === 'LIVE' ? 'bg-green-500' : 'bg-ai-accent animate-pulse'}`} />
          <span className="text-[10px] font-bold text-white uppercase drop-shadow-md">{status}</span>
       </div>
       <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-[10px] font-black text-white/50">{participantId}</p>
       </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [summaries, setSummaries] = useState<RoomSummary[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomSummary | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedParticipantId, setExpandedParticipantId] = useState<string | null>(null);
  const [isEditingWaitMsg, setIsEditingWaitMsg] = useState(false);
  const [isEditingTerms, setIsEditingTerms] = useState(false);
  const [tempWaitMsg, setTempWaitMsg] = useState('');
  const [tempWaitTitle, setTempWaitTitle] = useState('');
  const [tempIconType, setTempIconType] = useState('Activity');
  const [tempStandardTerms, setTempStandardTerms] = useState('');
  const [tempCameraTerms, setTempCameraTerms] = useState('');
  const [liveViewParticipantId, setLiveViewParticipantId] = useState<string | null>(null);

  const DEFAULT_WAIT_MSG = "시험 시작 전 시스템 환경을 점검해 주세요. 전체 화면 모드가 유지되어야 하며, 시험 중 브라우저 이탈 시 부정행위로 간주될 수 있습니다.";

  const ICON_OPTIONS = {
    Activity, Monitor, Target, Cpu, BookOpen, CheckCircle, Building2, ShieldAlert
  };

  const [isMosaicMode, setIsMosaicMode] = useState(false);

  const authHeader = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` };

  const fetchSummaries = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/dashboard/summary`, { headers: authHeader });
      if (res.ok) setSummaries(await res.json());
    } catch {}
  };

  const fetchRoomDetail = async (roomId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/dashboard?roomId=${roomId}`, { headers: authHeader });
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants);
      }
    } catch {}
    setLoading(false);
  };

  // 감사 로그 기록 유틸리티
  const logAccess = async (participantId: string, action: string) => {
    try {
      await fetch(`${API_BASE_URL}/admin/participants/${participantId}/log-view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ action })
      });
    } catch (err) {
      console.error('Failed to log access', err);
    }
  };

  const updateStatus = async (roomId: string, newStatus: string) => {
    if (!confirm(`고사장 상태를 ${newStatus}(으)로 변경하시겠습니까?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/rooms/${roomId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchSummaries();
        if (selectedRoom) {
           const updated = summaries.find(s => s.id === roomId);
           if (updated) setSelectedRoom({ ...updated, status: newStatus });
        }
      }
    } catch {}
  };

  const handleSaveWaitMsg = async () => {
    if (!selectedRoom) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/rooms/${selectedRoom.id}/waiting-message`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ 
          message: tempWaitMsg,
          title: tempWaitTitle,
          icon: tempIconType,
          standardTerms: tempStandardTerms,
          cameraTerms: tempCameraTerms
        })
      });
      if (res.ok) {
        setSummaries(prev => prev.map(s => s.id === selectedRoom.id ? { 
          ...s, 
          waitingMessage: tempWaitMsg,
          waitingTitle: tempWaitTitle,
          iconType: tempIconType,
          standardTerms: tempStandardTerms,
          cameraTerms: tempCameraTerms
        } : s));
        setSelectedRoom({ 
          ...selectedRoom, 
          waitingMessage: tempWaitMsg,
          waitingTitle: tempWaitTitle,
          iconType: tempIconType,
          standardTerms: tempStandardTerms,
          cameraTerms: tempCameraTerms
        });
        setIsEditingWaitMsg(false);
        alert('대기 화면 설정이 저장되었습니다.');
      }
    } catch {}
  };

  useEffect(() => { fetchSummaries(); }, []);

  useEffect(() => {
    if (selectedRoom) {
      fetchRoomDetail(selectedRoom.id);
      const interval = setInterval(() => fetchRoomDetail(selectedRoom.id), 5000);
      return () => clearInterval(interval);
    } else {
        const interval = setInterval(fetchSummaries, 10000);
        return () => clearInterval(interval);
    }
  }, [selectedRoom]);

  // 시스템 전체 통합 통계 계산
  const systemStats = {
    totalRooms: summaries.length,
    activeRooms: summaries.filter(s => s.status === 'IN_PROGRESS').length,
    totalUsers: summaries.reduce((sum, s) => sum + s.stats.total, 0),
    totalViolations: summaries.reduce((sum, s) => sum + s.stats.violations, 0),
  };

  const handleDownloadExcel = () => {
    if (!selectedRoom || participants.length === 0) return;
    
    // 문항 헤더 동적 생성 (Q1, Q2...)
    const maxQCount = participants[0]?.questionResults.length || 0;
    const qHeaders = Array.from({ length: maxQCount }, (_, i) => `Q${i+1}`);
    const headers = ["ID", "이름", "이메일", "응시상태", "총점(pt)", ...qHeaders, "위반감지횟수", "시험시작시각"];
    
    // 데이터 행 생성
    const rows = participants.map(p => {
      const qScores = [...p.questionResults]
        .sort((a, b) => a.orderNum - b.orderNum)
        .map(qr => qr.earnedPoint);
        
      return [
        p.id.split('-')[0],
        p.name,
        p.email,
        p.status,
        p.totalScore,
        ...qScores,
        p.violationCount,
        p.startedAt ? new Date(p.startedAt).toLocaleString('ko-KR') : '미응시'
      ];
    });

    // CSV 문자열로 결합
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    
    // 파일 다운로드 시작 (BOM 추가하여 엑셀 한글 깨짐 방지)
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `평가결과리포트_${selectedRoom.roomName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 대시보드 요약 뷰 (초기 화면)
  if (!selectedRoom) {
    return (
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold text-text-title tracking-tight">종합 모니터링 대시보드</h1>
            <p className="text-text-caption mt-1 flex items-center font-medium">
              <Activity size={14} className="mr-1 text-primary"/> 시스템 가동 현황 및 고사장별 실시간 위반 탐지
            </p>
          </div>
          <button onClick={fetchSummaries} className="p-2.5 bg-white border border-button-outline rounded-xl hover:bg-bg-section transition shadow-sm">
            <RefreshCcw size={18} className="text-text-caption" />
          </button>
        </div>

        {/* 시스템 레벨 통합 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <div className="bg-primary-strong p-6 rounded-[2rem] text-white shadow-xl flex flex-col justify-between">
              <div className="flex justify-between items-start">
                 <Building2 size={24} className="text-ai-accent" />
                 <span className="text-[10px] font-black opacity-60 uppercase">Total Rooms</span>
              </div>
              <div className="mt-8">
                 <div className="text-4xl font-black">{systemStats.totalRooms}</div>
                 <div className="text-xs font-bold opacity-70 mt-1">운영 평가장 총계</div>
              </div>
           </div>
           <div className="bg-bg-default border border-button-outline p-6 rounded-[2rem] shadow-sm">
              <div className="text-ai-accent mb-2"><Timer size={22} /></div>
              <div className="text-2xl font-black text-text-title">{systemStats.activeRooms}</div>
              <div className="text-[10px] font-bold text-text-caption uppercase">현재 활성(시험중) 고사장</div>
           </div>
           <div className="bg-bg-default border border-button-outline p-6 rounded-[2rem] shadow-sm">
              <div className="text-primary mb-2"><Users size={22} /></div>
              <div className="text-2xl font-black text-text-title">{systemStats.totalUsers.toLocaleString()}</div>
              <div className="text-[10px] font-bold text-text-caption uppercase">전체 배정 수험생</div>
           </div>
           <div className="bg-red-50 border border-red-100 p-6 rounded-[2rem] shadow-sm">
              <div className="text-red-500 mb-2"><ShieldAlert size={22} /></div>
              <div className="text-2xl font-black text-red-600">{systemStats.totalViolations.toLocaleString()}</div>
              <div className="text-[10px] font-bold text-red-400 uppercase">시스템 전체 위반 로그</div>
           </div>
        </div>

        <div className="pt-4">
           <div className="flex items-center space-x-2 mb-6">
              <LayoutGrid size={20} className="text-primary" />
              <h2 className="text-xl font-bold text-text-title underline decoration-ai-accent decoration-4 underline-offset-8">고사장별 실시간 모니터링</h2>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {summaries.map(room => {
              const progress = room.stats.total > 0 ? (room.stats.completed / room.stats.total) * 100 : 0;
              const hasAlert = room.stats.violations > 5; // 위반이 5건 이상이면 시각적 경고

              return (
                <div 
                  key={room.id} 
                  onClick={() => setSelectedRoom(room)}
                  className={`bg-bg-default border-2 rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden ${hasAlert ? 'border-red-200' : 'border-button-outline hover:border-primary'}`}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-2">
                       <span className={`w-2 h-2 rounded-full ${room.status === 'IN_PROGRESS' ? 'bg-ai-accent animate-pulse' : 'bg-atomic-gray-300'}`} />
                       <span className="text-[10px] font-black text-text-caption uppercase tracking-widest">{room.status}</span>
                    </div>
                    {hasAlert && <div className="text-red-500 animate-bounce"><AlertTriangle size={20} /></div>}
                  </div>

                  <h3 className="text-2xl font-black text-text-title mb-1 group-hover:text-primary transition-colors leading-tight">{room.roomName}</h3>
                  <p className="text-xs text-text-caption mb-3 font-medium truncate">{room.examTitle}</p>
                  
                  <div className="flex items-center space-x-2 text-[10px] font-bold text-primary bg-primary/5 px-3 py-1.5 rounded-xl border border-primary/10 w-fit mb-6">
                     <Timer size={12} />
                     <span>{new Date(room.startAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ~ {new Date(room.endAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {/* 진행률 바 */}
                  <div className="mb-8 space-y-2">
                     <div className="flex justify-between text-[10px] font-bold text-text-caption">
                        <span>진행상황</span>
                        <span>{Math.round(progress)}% 완료</span>
                     </div>
                     <div className="w-full h-2 bg-bg-section rounded-full overflow-hidden">
                        <div 
                           className={`h-full transition-all duration-1000 ${hasAlert ? 'bg-red-500' : 'bg-primary'}`} 
                           style={{ width: `${progress}%` }} 
                        />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-bg-section/40 p-4 rounded-3xl">
                        <div className="text-lg font-black text-text-title">{room.stats.testing}</div>
                        <div className="text-[9px] font-bold text-text-caption uppercase">현재 응시 중</div>
                    </div>
                    <div className={`${hasAlert ? 'bg-red-100' : 'bg-bg-section/40'} p-4 rounded-3xl transition-colors`}>
                        <div className={`text-lg font-black ${hasAlert ? 'text-red-600' : 'text-text-title'}`}>{room.stats.violations}</div>
                        <div className={`text-[9px] font-bold ${hasAlert ? 'text-red-400' : 'text-text-caption'} uppercase`}>위반 감지</div>
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-between text-primary font-black text-sm group-hover:translate-x-1 transition-transform">
                    <span>집중 모니터링 진입</span>
                    <ChevronRight size={18} />
                  </div>
                </div>
              );
            })}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in slide-in-from-right-4 duration-300 pb-12">
       <div className="flex items-center justify-between bg-white p-6 rounded-[2.5rem] border border-button-outline shadow-sm">
          <div className="flex items-center space-x-6">
            <button 
              onClick={() => setSelectedRoom(null)}
              className="p-4 bg-bg-section border border-button-outline rounded-3xl hover:bg-bg-default transition text-text-caption group"
            >
              <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
            </button>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-3xl font-black text-text-title">{selectedRoom.roomName}</h1>
                <div className="flex items-center px-2 py-1 bg-ai-accent/10 border border-ai-accent/20 rounded-lg">
                   <Monitor size={12} className="text-ai-accent mr-1.5" />
                   <span className="text-[10px] font-black text-ai-accent uppercase">Live Center</span>
                </div>
                {selectedRoom.status === 'READY' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); updateStatus(selectedRoom.id, 'IN_PROGRESS'); }}
                    className="ml-4 px-4 py-1.5 bg-primary text-white text-[11px] font-black rounded-lg shadow-lg hover:scale-105 transition"
                  >
                    시험 시작하기
                  </button>
                )}
                {selectedRoom.status === 'IN_PROGRESS' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); updateStatus(selectedRoom.id, 'CLOSED'); }}
                    className="ml-4 px-4 py-1.5 bg-red-600 text-white text-[11px] font-black rounded-lg shadow-lg hover:scale-105 transition"
                  >
                    시험 종료(마감)
                  </button>
                )}
              </div>
              <p className="text-sm text-text-caption mt-1 font-medium">{selectedRoom.examTitle} 상세 관제 모드</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
             {/* 대기 화면 편집 섹션 */}
              <button 
                 onClick={() => { 
                    setTempWaitMsg(selectedRoom.waitingMessage || ''); 
                    setTempWaitTitle(selectedRoom.waitingTitle || 'AI 평가 샌드박스');
                    setTempIconType(selectedRoom.iconType || 'Activity');
                    setIsEditingWaitMsg(true); 
                 }}
                 className="flex items-center space-x-3 bg-ai-accent/5 border border-ai-accent/10 px-6 py-3.5 rounded-3xl hover:bg-ai-accent/10 transition-all group"
              >
                 <div className="flex flex-col items-start">
                    <span className="text-[9px] font-black text-ai-accent uppercase tracking-widest">Wait Screen</span>
                    <span className="text-[11px] font-bold text-text-title">대기 안내 및 미리보기</span>
                 </div>
                 <div className="p-1.5 bg-ai-accent/10 rounded-lg group-hover:scale-110 transition-transform">
                    <Monitor size={14} className="text-ai-accent" />
                 </div>
              </button>

              {/* 추가된 약관 관리 버튼 */}
              <button 
                onClick={() => { 
                   setTempStandardTerms(selectedRoom.standardTerms || '시험 본인 확인 및 부정행위 방지를 위해 성명, 이메일 정보를 수집합니다.');
                   setTempCameraTerms(selectedRoom.cameraTerms || '실시간 감독을 위해 시험 중 수험생의 안면 및 주변 환경 영상을 수집 및 저장합니다.');
                   setIsEditingTerms(true); 
                }}
                className="flex items-center space-x-3 bg-emerald-50 border border-emerald-100 px-6 py-3.5 rounded-3xl hover:bg-emerald-100 transition-all group"
              >
                <div className="flex flex-col items-start text-left">
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Legal & Privacy</span>
                    <span className="text-[11px] font-bold text-emerald-800">약관 및 정보동의 관리</span>
                 </div>
                 <div className="p-1.5 bg-emerald-100 rounded-lg group-hover:scale-110 transition-transform">
                    <ShieldCheck size={14} className="text-emerald-600" />
                 </div>
              </button>
              <button 
                onClick={() => setIsMosaicMode(!isMosaicMode)}
                className={`flex items-center space-x-2 px-6 py-4 rounded-3xl font-black text-sm transition-all shadow-sm ${isMosaicMode ? 'bg-primary text-white' : 'bg-white text-primary border border-primary/20 hover:bg-primary/10'}`}
              >
                 <LayoutGrid size={18} />
                 <span>{isMosaicMode ? '리스트 뷰로 전환' : '모자이크 관제 모드'}</span>
              </button>
              <button 
                onClick={handleDownloadExcel}
               className="hidden lg:flex items-center space-x-2 bg-emerald-50 text-emerald-600 border border-emerald-200 px-6 py-4 rounded-3xl font-black text-sm hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
             >
                <Download size={18} />
                <span>엑셀 결과 리포트 다운로드</span>
             </button>
             
             <div className="hidden md:flex items-center space-x-8 border-l border-button-outline pl-8 ml-2">
                <div className="text-center">
                   <div className="text-[10px] text-text-caption font-black uppercase mb-1">Total</div>
                   <div className="text-xl font-black text-text-title">{selectedRoom.stats.total}</div>
                </div>
                <div className="text-center">
                   <div className="text-[10px] text-primary font-black uppercase mb-1">Testing</div>
                   <div className="text-xl font-black text-primary">{selectedRoom.stats.testing}</div>
                </div>
                <div className="text-center">
                   <div className="text-[10px] text-red-400 font-black uppercase mb-1">Alerts</div>
                   <div className="text-xl font-black text-red-600">{selectedRoom.stats.violations}</div>
                </div>
             </div>
          </div>
       </div>

       <div className="bg-bg-default border border-button-outline rounded-[3rem] shadow-xl overflow-hidden relative">
          {loading && <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 flex items-center justify-center font-black text-primary text-lg">SYNCING DATA...</div>}
          <div className="px-10 py-6 border-b border-button-outline bg-bg-section/30 flex items-center justify-between">
             <h3 className="font-black text-text-title flex items-center space-x-3">
                <Users size={22} className="text-primary" />
                <span className="text-lg">{isMosaicMode ? "실시간 모자이크 통합 관제" : "실시간 개별 수험생 모니터링"}</span>
             </h3>
             {isMosaicMode && (
               <div className="flex items-center space-x-2 text-[10px] font-black text-primary-strong uppercase">
                  <div className="w-2 h-2 rounded-full bg-ai-accent animate-pulse" />
                  <span>{participants.filter(p => p.status === 'TESTING').length} Active Streams</span>
               </div>
             )}
          </div>

          {isMosaicMode ? (
            <div className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 bg-bg-section/10">
               {participants.filter(p => p.status === 'TESTING').map(p => (
                 <div key={p.id} className="relative group" onClick={() => logAccess(p.id, 'MOSAIC_FOCUS')}>
                    <div className="aspect-video bg-black rounded-[2rem] overflow-hidden border-2 border-transparent group-hover:border-primary transition-all shadow-lg">
                       <KvsViewerItem participantId={p.id} />
                    </div>
                    <div className="mt-4 flex items-center justify-between px-2">
                       <div>
                          <p className="font-black text-text-title text-sm">{p.name}</p>
                          <p className="text-[10px] text-text-caption font-bold">{p.email}</p>
                       </div>
                       <div className={`px-2 py-1 rounded-lg text-[10px] font-black ${p.violationCount > 0 ? 'bg-red-500 text-white' : 'bg-bg-section text-text-caption'}`}>
                          {p.violationCount} ERR
                       </div>
                    </div>
                 </div>
               ))}
               {participants.filter(p => p.status === 'TESTING').length === 0 && (
                 <div className="col-span-full py-20 text-center flex flex-col items-center">
                    <VideoOff size={48} className="text-atomic-gray-300 mb-4" />
                    <p className="text-text-caption font-bold italic">현재 시험 중인 인원이 없습니다.</p>
                 </div>
               )}
            </div>
          ) : (
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-bg-section/50 text-text-caption border-b border-button-outline">
                   <tr>
                      <th className="px-10 py-5 text-[11px] font-black uppercase tracking-widest">Candidate Information</th>
                      <th className="px-10 py-5 text-[11px] font-black uppercase tracking-widest">Progress Status</th>
                      <th className="px-10 py-5 text-[11px] font-black uppercase tracking-widest">Score / Results</th>
                      <th className="px-10 py-5 text-[11px] font-black uppercase tracking-widest text-right">Security Log</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-button-outline">
                   {participants.map(p => (
                     <React.Fragment key={p.id}>
                      <tr 
                        onClick={() => setExpandedParticipantId(expandedParticipantId === p.id ? null : p.id)}
                        className="hover:bg-bg-section/20 transition-all group cursor-pointer"
                      >
                         <td className="px-10 py-6">
                            <div className="font-black text-text-title group-hover:text-primary transition-colors text-base flex items-center">
                               {expandedParticipantId === p.id ? <ChevronRight size={16} className="rotate-90 mr-2 transition-transform"/> : <ChevronRight size={16} className="mr-2 transition-transform"/>}
                               {p.name}
                            </div>
                            <div className="text-xs text-text-caption mt-1 font-mono ml-6">{p.email}</div>
                         </td>
                         <td className="px-10 py-6">
                             <div className={`inline-flex items-center px-4 py-1.5 rounded-2xl text-xs font-black shadow-sm ${
                                p.status === 'READY' ? 'bg-bg-section text-atomic-gray-500' :
                                p.status === 'TESTING' ? 'bg-primary text-white shadow-primary/30' :
                                p.status === 'COMPLETED' ? 'bg-emerald-500 text-white shadow-emerald-200' :
                                'bg-red-600 text-white'
                             }`}>
                               <span className={`w-1.5 h-1.5 rounded-full mr-2 bg-white ${p.status === 'TESTING' ? 'animate-pulse' : ''}`} />
                               {p.status}
                             </div>
                         </td>
                         <td className="px-10 py-6">
                            {p.status === 'COMPLETED' ? (
                               <div>
                                  <div className="text-lg font-black text-emerald-600">{p.totalScore}pt</div>
                                  <div className="text-[9px] font-bold text-text-caption uppercase">최종 평가 점수</div>
                               </div>
                            ) : (
                               <div className="text-sm font-bold text-text-caption opacity-40">-- pt</div>
                            )}
                         </td>
                         <td className="px-10 py-6 text-right">
                            <div className="flex items-center justify-end space-x-3">
                               {p.status === 'TESTING' && (
                                  <button 
                                     onClick={(e) => { 
                                        e.stopPropagation(); 
                                        logAccess(p.id, 'LIVE_VIEW');
                                        setLiveViewParticipantId(p.id); 
                                     }}
                                     className="bg-primary text-white p-2.5 rounded-xl hover:bg-primary-strong transition-all shadow-md shadow-primary/20"
                                     title="라이브 화면 보기"
                                  >
                                     <Video size={18} />
                                  </button>
                               )}
                               {p.videoUrl && (
                                  <button 
                                     onClick={(e) => { 
                                        e.stopPropagation(); 
                                        logAccess(p.id, 'REPLAY_VIEW');
                                        window.open(p.videoUrl, '_blank'); 
                                     }}
                                     className="bg-ai-accent text-white p-2.5 rounded-xl hover:bg-ai-accent/80 transition-all shadow-md shadow-ai-accent/20"
                                     title="녹화본 다시보기 (HLS)"
                                  >
                                     <Activity size={18} />
                                  </button>
                               )}
                               <span className={`px-3 py-1.5 rounded-xl text-sm font-black ${p.violationCount > 0 ? 'bg-red-50 text-red-500 border border-red-100 ring-2 ring-red-500/10' : 'text-atomic-gray-300'}`}>
                                 {p.violationCount} Detection
                               </span>
                            </div>
                         </td>
                      </tr>
                      {expandedParticipantId === p.id && (
                        <tr className="bg-bg-section/10">
                           <td colSpan={4} className="px-10 py-8">
                              <div className="bg-white rounded-[2rem] border border-button-outline p-8 shadow-inner">
                                 <h4 className="text-sm font-black text-text-title uppercase tracking-widest mb-6 flex items-center">
                                    <Target size={16} className="mr-2 text-primary" /> 문항별 상세 평가 결과
                                 </h4>
                                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    {[...p.questionResults].sort((a, b) => a.orderNum - b.orderNum).map(qr => (
                                       <div key={qr.questionId} className="bg-bg-section/40 p-4 rounded-2xl border border-button-outline/50">
                                          <div className="flex justify-between items-start mb-2">
                                             <span className="text-[10px] font-black text-text-caption">Q{qr.orderNum}</span>
                                             <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${qr.earnedPoint === qr.point ? 'bg-emerald-100 text-emerald-600' : qr.earnedPoint > 0 ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                                                {qr.earnedPoint === qr.point ? '정답' : qr.earnedPoint > 0 ? '부분점수' : '오답'}
                                             </span>
                                          </div>
                                          <div className="flex items-end space-x-1">
                                             <span className="text-lg font-black text-text-title">{qr.earnedPoint}</span>
                                             <span className="text-[10px] font-bold text-text-caption mb-1">/ {qr.point}pt</span>
                                          </div>
                                       </div>
                                    ))}
                                    {p.questionResults.length === 0 && (
                                       <div className="col-span-full py-4 text-center text-xs text-text-caption italic font-medium">제출된 답안 정보가 없습니다.</div>
                                    )}
                                 </div>
                                  <h4 className="text-sm font-black text-text-title uppercase tracking-widest mb-6 flex items-center mt-10">
                                     <ShieldAlert size={16} className="mr-2 text-red-500" /> 실시간 위반 탐지 기록
                                  </h4>
                                  <div className="space-y-3">
                                     {p.securityLogs.map(log => (
                                        <div key={log.id} className="flex justify-between items-center p-4 bg-red-50/50 rounded-2xl border border-red-100 group/log">
                                           <div className="flex items-center space-x-3">
                                              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                              <div className="flex flex-col">
                                                 <span className="text-sm font-black text-red-700">{VIOLATION_MAP[log.violationType] || log.violationType}</span>
                                                 <span className="text-[10px] font-bold text-red-400">
                                                    {new Date(log.capturedAt).toLocaleTimeString('ko-KR')} 발생
                                                 </span>
                                              </div>
                                           </div>
                                           <div className="flex items-center space-x-2">
                                              {log.clipUrl && (
                                                 <button 
                                                    onClick={(e) => { e.stopPropagation(); window.open(log.clipUrl, '_blank'); }}
                                                    className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-xl text-[11px] font-black hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                                 >
                                                    전후 10초 클립 확인
                                                 </button>
                                              )}
                                           </div>
                                        </div>
                                     ))}
                                     {p.securityLogs.length === 0 && (
                                        <div className="py-6 text-center text-xs text-text-caption italic font-medium bg-bg-section/20 rounded-2xl">탐지된 위반 사항이 없습니다.</div>
                                     )}
                                  </div>
                              </div>
                           </td>
                        </tr>
                      )}
                     </React.Fragment>
                   ))}
                   {participants.length === 0 && (
                     <tr>
                        <td colSpan={4} className="py-24 text-center text-text-caption italic font-medium">데이터가 없습니다.</td>
                     </tr>
                   )}
                </tbody>
             </table>
          </div>
          )}
       </div>

       {/* 대기 화면 편집 및 미리보기 모달 */}
       {isEditingWaitMsg && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-text-title/40 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px] border border-button-outline">
              {/* 왼쪽: 편집 영역 */}
              <div className="flex-1 p-10 border-r border-button-outline overflow-y-auto">
                 <div className="flex items-center space-x-2 mb-8">
                    <div className="p-2 bg-primary/10 rounded-xl">
                       <Monitor size={20} className="text-primary" />
                    </div>
                    <h2 className="text-2xl font-black text-text-title">대기 화면 편집</h2>
                 </div>
                 
                 <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-black text-text-caption uppercase tracking-widest mb-2">대기 화면 타이틀</label>
                        <input 
                           type="text"
                           value={tempWaitTitle}
                           onChange={(e) => setTempWaitTitle(e.target.value)}
                           className="w-full p-4 bg-bg-section/50 border-2 border-button-outline rounded-2xl outline-none focus:border-primary transition-all font-bold text-text-title"
                        />
                     </div>

                     <div>
                        <label className="block text-xs font-black text-text-caption uppercase tracking-widest mb-2">대표 아이콘 선택</label>
                        <div className="grid grid-cols-4 gap-3">
                           {Object.entries(ICON_OPTIONS).map(([name, Icon]) => (
                              <button 
                                 key={name}
                                 onClick={() => setTempIconType(name as any)}
                                 className={`p-4 rounded-xl border-2 flex items-center justify-center transition-all ${tempIconType === name ? 'border-primary bg-primary/5 text-primary' : 'border-button-outline text-text-caption hover:border-atomic-gray-300'}`}
                              >
                                 {React.createElement(Icon, { size: 20 })}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div>
                        <label className="block text-xs font-black text-text-caption uppercase tracking-widest mb-2">안내 문구 입력</label>
                        <textarea 
                           value={tempWaitMsg}
                           onChange={(e) => setTempWaitMsg(e.target.value)}
                           className="w-full h-32 p-6 bg-bg-section/50 border-2 border-button-outline rounded-3xl outline-none focus:border-primary transition-all font-medium text-text-body leading-relaxed resize-none"
                        />
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-button-outline">
                        <div>
                           <label className="block text-xs font-black text-text-caption uppercase tracking-widest mb-2 flex items-center">
                              <ShieldCheck size={14} className="mr-1 text-primary" /> 개인정보 기본 약관
                           </label>
                           <textarea 
                              value={tempStandardTerms}
                              onChange={(e) => setTempStandardTerms(e.target.value)}
                              className="w-full h-32 p-4 bg-bg-section/30 border-2 border-button-outline rounded-2xl outline-none focus:border-primary transition-all text-[11px] font-medium leading-relaxed resize-none"
                              placeholder="카메라 미사용 시 노출될 기본 약관을 입력하세요."
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-black text-text-caption uppercase tracking-widest mb-2 flex items-center">
                              <Video size={14} className="mr-1 text-red-500" /> 카메라 수집 약관
                           </label>
                           <textarea 
                              value={tempCameraTerms}
                              onChange={(e) => setTempCameraTerms(e.target.value)}
                              className="w-full h-32 p-4 bg-bg-section/30 border-2 border-button-outline rounded-2xl outline-none focus:border-primary transition-all text-[11px] font-medium leading-relaxed resize-none"
                              placeholder="카메라 사용 시 추가로 보일 약관을 입력하세요."
                           />
                        </div>
                     </div>
                 </div>
                 
                 <div className="flex items-center space-x-3 pt-8">
                    <button 
                       onClick={handleSaveWaitMsg}
                       className="flex-1 py-4 bg-primary text-white rounded-2xl font-black text-lg shadow-lg shadow-primary/20 hover:bg-primary-strong transition-all"
                    >
                       저장 및 적용
                    </button>
                    <button 
                       onClick={() => setIsEditingWaitMsg(false)}
                       className="px-8 py-4 bg-bg-section text-text-caption rounded-2xl font-black text-lg hover:bg-atomic-gray-100 transition-all"
                    >
                       취소
                    </button>
                 </div>
              </div>

              {/* 오른쪽: 미리보기 영역 */}
              <div className="flex-1 bg-bg-section/30 p-10 flex flex-col items-center justify-center relative overflow-hidden">
                 <div className="absolute top-6 left-6 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-text-caption uppercase">Live Student Preview</span>
                 </div>

                 {/* 수험생 Entry 화면 모사 */}
                 <div className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-8 border border-button-outline scale-90 md:scale-100 transition-transform">
                    <div className="text-center mb-6">
                       <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          {React.createElement(ICON_OPTIONS[tempIconType as keyof typeof ICON_OPTIONS] || Activity, { size: 24, className: "text-primary" })}
                       </div>
                       <h3 className="text-xl font-black text-text-title">{tempWaitTitle || 'AI 평가 샌드박스'}</h3>
                       <p className="text-[10px] text-text-caption font-bold mt-1">접속 코드: {selectedRoom?.id.split('-')[0].toUpperCase()}</p>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 text-center">
                       <div className="text-primary font-black text-[10px] uppercase tracking-widest mb-2">시험 오픈 대기 중</div>
                       <div className="text-4xl font-mono font-black text-text-title tracking-tighter mb-4">00:15:30</div>
                       <div className="p-4 bg-white/60 border border-button-outline rounded-xl text-[11px] text-text-body font-bold leading-relaxed min-h-[80px]">
                          {tempWaitMsg || DEFAULT_WAIT_MSG}
                       </div>
                       <div className="text-[9px] text-text-caption mt-4 font-bold">오픈 예정: 2026.04.10 오후 02:00:00</div>
                    </div>
                    
                    <div className="mt-8 flex items-center space-x-2 px-2 opacity-40">
                      <div className="w-4 h-4 border border-atomic-gray-400 rounded" />
                      <div className="h-2 w-32 bg-atomic-gray-200 rounded" />
                    </div>
                 </div>
                 
                 <p className="mt-8 text-xs text-text-caption font-bold italic opacity-60">※ 실제 수험생 화면과 99% 동일하게 렌더링됩니다.</p>
              </div>
           </div>
         </div>
       )}

        {isEditingTerms && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-text-title/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-emerald-100">
               <div className="p-10 border-b border-button-outline bg-emerald-50/30">
                  <div className="flex items-center space-x-4 mb-2">
                     <div className="p-3 bg-emerald-100 rounded-2xl">
                        <ShieldCheck size={28} className="text-emerald-600" />
                     </div>
                     <div>
                        <h2 className="text-3xl font-black text-text-title">약관 및 정보동의 편집기</h2>
                        <p className="text-sm text-text-caption font-bold tracking-tight">카메라 사용 여부에 따라 수험생에게 보여질 법적 동의 문구를 관리합니다.</p>
                     </div>
                  </div>
               </div>
               
               <div className="p-10 space-y-8 overflow-y-auto max-h-[60vh]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                     <div className="space-y-4">
                        <label className="flex items-center text-xs font-black text-text-title uppercase tracking-widest bg-white px-2 py-1 border-l-4 border-emerald-500 w-fit">
                           <ShieldCheck size={14} className="mr-2 text-emerald-500" /> 기본 개인정보 약관 (필수)
                        </label>
                        <textarea 
                           value={tempStandardTerms}
                           onChange={(e) => setTempStandardTerms(e.target.value)}
                           className="w-full h-72 p-6 bg-bg-section/50 border-2 border-button-outline rounded-3xl outline-none focus:border-emerald-500 transition-all text-xs font-medium leading-relaxed resize-none shadow-inner"
                           placeholder="모든 시험에서 기본적으로 노출되는 개인정보 처리방침입니다."
                        />
                     </div>
                     <div className="space-y-4">
                        <label className="flex items-center text-xs font-black text-text-title uppercase tracking-widest bg-white px-2 py-1 border-l-4 border-red-500 w-fit">
                           <Video size={14} className="mr-2 text-red-500" /> 카메라 수집 약관 (자동 노출)
                        </label>
                        <textarea 
                           value={tempCameraTerms}
                           onChange={(e) => setTempCameraTerms(e.target.value)}
                           className="w-full h-72 p-6 bg-bg-section/50 border-2 border-button-outline rounded-3xl outline-none focus:border-red-500 transition-all text-xs font-medium leading-relaxed resize-none shadow-inner"
                           placeholder="카메라 모니터링이 활성화된 경우에만 추가로 노출되는 약관입니다."
                        />
                     </div>
                  </div>

                  <div className="bg-emerald-50/50 rounded-3xl p-6 border-2 border-dashed border-emerald-100 text-center">
                     <p className="text-xs font-black text-emerald-700 flex items-center justify-center gap-2">
                        <AlertTriangle size={16} className="text-amber-500" />
                        수험생이 동의 창에서 보게 될 실시간 동의서의 내용을 변경합니다.
                     </p>
                  </div>
               </div>

               <div className="p-10 bg-emerald-50/30 border-t border-emerald-50 flex items-center space-x-4">
                  <button 
                     onClick={handleSaveWaitMsg}
                     className="flex-[2] py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all transform active:scale-95"
                  >
                     저장하고 실제 적용하기
                  </button>
                  <button 
                     onClick={() => setIsEditingTerms(false)}
                     className="flex-1 py-5 bg-white text-text-caption border-2 border-button-outline rounded-[2rem] font-black text-lg hover:bg-bg-section transition-all"
                  >
                     취소
                  </button>
               </div>
            </div>
          </div>
        )}

       {liveViewParticipantId && (
          <KvsViewer 
            participantId={liveViewParticipantId} 
            onClose={() => setLiveViewParticipantId(null)} 
          />
       )}
    </div>
  );
}
