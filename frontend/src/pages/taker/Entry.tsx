import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, MonitorPlay, AlertTriangle, ArrowRight, Video, VideoOff, Camera, CheckCircle2, Settings, Globe, X } from 'lucide-react';
import { API_BASE_URL } from '../../config';


export default function Entry() {
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [waitingStartTime, setWaitingStartTime] = useState<string | null>(null);
  const [waitingMessage, setWaitingMessage] = useState('');
  const [countdown, setCountdown] = useState('');
  const [isRequireCamera, setIsRequireCamera] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState({
    privacy: false,
    camera: false,
    retention: false,
  });
  
  // 환경 점검 상태
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const [cameraTerms, setCameraTerms] = useState('');
  const [standardTerms, setStandardTerms] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const codeInUrl = searchParams.get('code');
    if (codeInUrl) {
      setInviteCode(codeInUrl);
      setIsChecked(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!waitingStartTime) return;
    const interval = setInterval(() => {
      const diff = new Date(waitingStartTime).getTime() - Date.now();
      if (diff <= 0) {
        setWaitingStartTime(null);
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [waitingStartTime]);

  // 시스템 환경 점검 (캠 전용)
  const startSystemCheck = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false 
      });
      setStream(mediaStream);
      setHasCameraPermission(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      alert('카메라 권한을 승인해야 입장이 가능합니다. 브라우저 주소창 왼쪽의 자물쇠 아이콘을 눌러 권한을 허용해 주세요.');
      setHasCameraPermission(false);
    }
  };

  const resetState = () => {
    setInviteCode('');
    setIsChecked(false);
    setWaitingStartTime(null);
    setWaitingMessage('');
    setTermsAgreed({ privacy: false, camera: false, retention: false });
    setIsTermsOpen(false);
  };

  const handleStart = async (forceEnter = false) => {
    // 1. 기본 유효성 검사
    if ((!isChecked && !forceEnter) || !inviteCode) return;
    
    // 2. 약관 동의 확인
    const isReadyForTerms = termsAgreed.privacy && (!isRequireCamera || termsAgreed.camera) && termsAgreed.retention;
    if (!isReadyForTerms) {
       setIsTermsOpen(true);
       return;
    }

    // 3. 카메라 필수 고사장일 경우 장비 점검 확인
    if (isRequireCamera && !hasCameraPermission) {
      alert('환경 점검이 완료되지 않았습니다. 카메라를 활성화해 주세요.');
      setIsTermsOpen(false); // 모달 닫기 (장비 점검 유도)
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode, agreedTerms: true })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (data.type === 'NOT_STARTED_YET') {
          setIsTermsOpen(false);
          setWaitingStartTime(data.startTime);
          setWaitingMessage(data.waitingMessage);
          setIsRequireCamera(data.isRequireCamera || false);
          setStandardTerms(data.standardTerms || '');
          setCameraTerms(data.cameraTerms || '');
          if (data.isRequireCamera && !hasCameraPermission) {
             startSystemCheck();
          }
          return;
        }
        alert(`인증 실패: ${data.message || '서버 오류'}`);
        return;
      }
      
      const requireCam = data.examRoom.isRequireCamera;
      setIsRequireCamera(requireCam);
      setStandardTerms(data.examRoom.standardTerms || '');
      setCameraTerms(data.examRoom.cameraTerms || '');

      if (requireCam && !hasCameraPermission) {
        setIsTermsOpen(false);
        alert('이 고사장은 카메라 모니터링이 필수입니다. 환경 점검을 진행해 주세요.');
        return;
      }

      sessionStorage.setItem('participantId', data.participantId);
      sessionStorage.setItem('startedAt', data.startedAt);
      if (data.expiresAt) sessionStorage.setItem('expiresAt', data.expiresAt);
      sessionStorage.setItem('durationMinutes', data.examRoom.durationMinutes.toString());
      sessionStorage.setItem('isRequireCamera', requireCam ? 'true' : 'false');

      try {
        if (!document.fullscreenElement) {
           document.documentElement.requestFullscreen();
        }
      } catch (e) {}
      navigate('/exam/sandbox');
    } catch (e) {
      alert('서버와 연결할 수 없습니다.');
    }
  };

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [stream]);

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-bg-section p-4 md:p-10 overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-ai-accent blur-[160px] opacity-10 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary blur-[140px] opacity-10 pointer-events-none" />

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-12 z-10 items-stretch">
        
        {/* 설명 영역 */}
        <div className="lg:col-span-12 xl:col-span-5 flex flex-col justify-center space-y-8">
          <div>
            <div className="inline-flex text-4xl font-black tracking-widest text-primary-strong uppercase mb-2">
              ALPACO
            </div>
            <div className="w-16 h-1.5 bg-ai-accent rounded-full" />
          </div>

          <div className="space-y-6">
            <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-black mb-2 animate-pulse">
              <ShieldCheck size={18} strokeWidth={2.5} />
              <span>IBT SECURITY CENTER</span>
            </div>
            <h1 className="text-hero text-text-title leading-tight">
              AI 샌드박스<br/>
              <span className="text-primary-strong">환경 점검 대기실</span>
            </h1>
            <p className="text-text-body text-body-reading leading-relaxed opacity-80">
              시험 입장 전 카메라 상태를 확인해 주세요. <br/>
              실시간 모니터링 시스템은 시험 중 수험생의 이탈 및 부정행위를 감지하며, 전 과정이 녹화됩니다.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="bg-white/50 border border-button-outline p-4 rounded-3xl">
                <Globe size={24} className="text-primary mb-2" />
                <p className="text-xs font-black text-text-title uppercase mb-1">Network</p>
                <p className="text-sm font-bold text-text-caption">Stable Connection</p>
             </div>
             <div className="bg-white/50 border border-button-outline p-4 rounded-3xl">
                <Settings size={24} className="text-primary mb-2" />
                <p className="text-xs font-black text-text-title uppercase mb-1">System</p>
                <p className="text-sm font-bold text-text-caption">Latest Browser</p>
             </div>
          </div>
        </div>

        {/* 점검 카드 영역 */}
        <div className="lg:col-span-12 xl:col-span-7 flex flex-col justify-center">
          <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-atomic-gray-300/20 relative overflow-hidden">
             {/* 상태 상단 헤더 */}
            <div className="flex justify-between items-center mb-8 border-b border-atomic-gray-50 pb-6">
               <h3 className="text-2xl font-black text-text-title flex items-center space-x-3">
                 <MonitorPlay className="text-primary" size={28} />
                 <span>검증 및 대기</span>
               </h3>
               {hasCameraPermission && (
                  <div className="flex items-center space-x-2 bg-green-50 text-green-600 px-4 py-1.5 rounded-full text-xs font-black border border-green-200">
                     <CheckCircle2 size={14} />
                     <span>SYSTEM READY</span>
                  </div>
               )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
               {/* 왼쪽: 캠 미리보기 */}
               <div className="space-y-4">
                  <div className="relative aspect-[4/3] bg-black rounded-[2rem] overflow-hidden border-2 border-primary/20 shadow-xl group">
                     {!hasCameraPermission ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-bg-section cursor-pointer" onClick={startSystemCheck}>
                           <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-primary shadow-md group-hover:scale-110 transition-transform">
                              <Camera size={32} />
                           </div>
                           <p className="text-xs font-black text-text-title">카메라 장비 활성화</p>
                        </div>
                     ) : (
                        <>
                           <video 
                              ref={videoRef} 
                              autoPlay 
                              playsInline 
                              muted 
                              className="w-full h-full object-cover mirror"
                           />
                           {/* 캠 가이드 라인 */}
                           <div className="absolute inset-0 border-[30px] border-black/10 pointer-events-none" />
                           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-64 border-2 border-dashed border-white/40 rounded-full pointer-events-none" />
                        </>
                     )}
                  </div>
                  
                  <div className="bg-bg-section p-5 rounded-2xl border border-button-outline flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                         <ShieldCheck size={20} />
                      </div>
                      <div>
                         <p className="text-[11px] font-black text-text-title">AI Proctoring Enabled</p>
                         <p className="text-[10px] font-bold text-text-caption">본 기능은 개인정보 보호를 위해 음성을 수집하지 않습니다.</p>
                      </div>
                  </div>
               </div>

               {/* 오른쪽: 코드 입력 및 동의 */}
               <div className="flex flex-col justify-between">
                  <div className="space-y-6">
                     <div className="relative">
                        <label className="block text-xs font-black text-text-caption uppercase mb-3 ml-1">초대 코드 (Invitation)</label>
                        <input 
                           type="text" 
                           placeholder="XXXX-XXXX-XXXX"
                           value={inviteCode}
                           onChange={(e) => setInviteCode(e.target.value)}
                           className="w-full text-2xl font-black px-6 py-4 bg-bg-section border-2 border-button-outline focus:border-primary focus:ring-8 focus:ring-primary/5 rounded-2xl outline-none transition-all uppercase placeholder:normal-case font-mono tracking-wider"
                        />
                        {inviteCode && (
                          <button 
                            onClick={resetState}
                            className="absolute right-4 top-[3.25rem] p-2 text-text-caption hover:text-primary transition-colors"
                            title="코드 초기화"
                          >
                             <X size={20} />
                          </button>
                        )}
                     </div>

                     <div className="bg-bg-section/70 rounded-3xl p-6 border-2 border-button-outline space-y-4">
                        <h4 className="text-sm font-black text-primary-strong flex items-center gap-2">
                           <AlertTriangle size={16} /> 부정행위 방지 서약
                        </h4>
                        <p className="text-text-caption text-xs font-bold leading-relaxed">
                           시험 중 전체화면 이탈, 캠 가해, 자리 비움 등은 부정행위로 간주되며 즉시 감독관에게 경고 알림이 차단됩니다.
                        </p>
                        <label className="flex items-center space-x-3 bg-white p-4 rounded-2xl border border-button-outline cursor-pointer hover:border-primary transition-all shadow-sm">
                           <input 
                               type="checkbox" 
                               checked={isChecked}
                               onChange={() => setIsChecked(!isChecked)}
                               className="w-5 h-5 text-primary rounded-lg focus:ring-primary border-button-outline"
                           />
                           <span className="text-xs text-text-title font-black">안내사항 숙지 및 동의함</span>
                        </label>
                     </div>
                  </div>

                  {waitingStartTime ? (
                  <div className="bg-primary p-8 rounded-[2rem] text-center text-white space-y-2 mt-6 shadow-xl shadow-primary/20 relative group">
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-80">STARTING IN</p>
                     <p className="text-4xl font-black font-mono tracking-tighter">{countdown}</p>
                     <p className="text-xs font-bold pt-2 opacity-90">{waitingMessage}</p>
                     <button 
                       onClick={resetState}
                       className="mt-4 px-6 py-2 bg-white/20 hover:bg-white/40 rounded-xl text-[11px] font-black transition-all"
                     >
                        코드 다시 입력 (취소)
                     </button>
                  </div>
                  ) : (
                  <button 
                     onClick={() => handleStart()}
                     disabled={!isChecked || !inviteCode}
                     className={`w-full flex items-center justify-center space-x-3 py-6 rounded-[2rem] font-black text-xl transition-all mt-6 shadow-lg transform active:scale-95 ${
                        isChecked && inviteCode 
                        ? 'bg-primary hover:bg-primary-strong text-white shadow-primary/30' 
                        : 'bg-bg-section text-text-caption border-2 border-button-outline cursor-not-allowed'
                     }`}
                  >
                     <span>{isRequireCamera && !hasCameraPermission ? '장비 점검 필요' : '평가 시작하기'}</span>
                     <ArrowRight size={24} strokeWidth={3} />
                  </button>
                  )}
               </div>
            </div>

            {/* 하단 점검 리스트 아이콘 */}
            <div className="flex items-center justify-center space-x-10 pt-4 border-t border-atomic-gray-50">
               <div className={`flex items-center space-x-2 text-[10px] font-black ${hasCameraPermission ? 'text-primary' : 'text-text-caption'}`}>
                  {hasCameraPermission ? <Video size={14} /> : <VideoOff size={14} />}
                  <span>SECURE CAMERA-ONLY FEED</span>
               </div>
               <div className="flex items-center space-x-2 text-[10px] font-black text-text-caption opacity-40">
                  <div className="w-3 h-3 rounded-full border border-current flex items-center justify-center text-[7px]">/</div>
                  <span>MIC DISABLED</span>
               </div>
               <div className="flex items-center space-x-2 text-[10px] font-black text-primary">
                  <CheckCircle2 size={14} />
                  <span>SECURE BROWSER</span>
               </div>
            </div>
          </div>
        </div>

      </div>
      <style>{`
        .mirror {
          transform: rotateY(180deg);
        }
      `}</style>

      {/* 개인정보 및 보안 동의 모달 */}
      {isTermsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-text-title/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-button-outline">
             <div className="p-10 border-b border-button-outline flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-3 mb-4">
                     <ShieldCheck size={32} className="text-primary" />
                     <h2 className="text-3xl font-black text-text-title">개인정보 수집 및 보안 동의</h2>
                  </div>
                  <p className="text-sm text-text-caption font-bold">평가의 공정성과 데이터 보호를 위해 다음 사항에 대한 동의가 필요합니다.</p>
                </div>
                <button onClick={() => setIsTermsOpen(false)} className="p-2 hover:bg-bg-section rounded-full transition-colors">
                   <X size={24} className="text-text-caption" />
                </button>
             </div>
             
             <div className="p-10 space-y-6 overflow-y-auto max-h-[60vh]">
                <div className="space-y-4">
                   <label className="flex items-start space-x-4 p-5 bg-bg-section/50 rounded-3xl border border-button-outline cursor-pointer hover:border-primary transition-all">
                      <input 
                         type="checkbox" 
                         checked={termsAgreed.privacy}
                         onChange={() => setTermsAgreed(prev => ({ ...prev, privacy: !prev.privacy }))}
                         className="mt-1 w-6 h-6 text-primary rounded-lg border-button-outline" 
                      />
                      <div>
                         <p className="font-black text-text-title text-base flex items-center mb-1">
                            개인정보 수집 및 이용 동의 (필수)
                            <span className="ml-2 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded">PIPA 준수</span>
                         </p>
                         <p className="text-[11px] text-text-body font-medium leading-relaxed">
                            {standardTerms || '시험 본인 확인 및 부정행위 방지를 위해 성명, 이메일 정보를 수집합니다. 수집된 정보는 본 평가 목적 이외의 용도로 사용되지 않습니다.'}
                         </p>
                      </div>
                   </label>

                   {isRequireCamera && (
                   <label className="flex items-start space-x-4 p-5 bg-bg-section/50 rounded-3xl border border-button-outline cursor-pointer hover:border-primary transition-all">
                      <input 
                         type="checkbox" 
                         checked={termsAgreed.camera}
                         onChange={() => setTermsAgreed(prev => ({ ...prev, camera: !prev.camera }))}
                         className="mt-1 w-6 h-6 text-primary rounded-lg border-button-outline" 
                      />
                      <div>
                         <p className="font-black text-text-title text-base flex items-center mb-1">
                            영상 정보(웹카메라) 수집 동의 (필수)
                            <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded">실시간 녹화</span>
                         </p>
                         <p className="text-[11px] text-text-body font-medium leading-relaxed">
                            {cameraTerms || '실시간 감독을 위해 시험 중 수험생의 안면 및 주변 환경 영상을 수집 및 저장합니다. 본 시스템은 사생활 보호를 위해 음성(마이크)은 수집하지 않습니다.'}
                         </p>
                      </div>
                   </label>
                   )}

                   <label className="flex items-start space-x-4 p-5 bg-bg-section/50 rounded-3xl border border-button-outline cursor-pointer hover:border-primary transition-all">
                      <input 
                         type="checkbox" 
                         checked={termsAgreed.retention}
                         onChange={() => setTermsAgreed(prev => ({ ...prev, retention: !prev.retention }))}
                         className="mt-1 w-6 h-6 text-primary rounded-lg border-button-outline" 
                      />
                      <div>
                         <p className="font-black text-text-title text-base flex items-center mb-1">
                            데이터 보유 기간 및 자동 파기 동의 (필수)
                            <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded">30일 후 자동 삭제</span>
                         </p>
                         <p className="text-[11px] text-text-body font-medium leading-relaxed">
                            수집된 영상 및 로그는 결과 확정 및 이의 제기 기간 고려를 위해 <strong>시험 종료일로부터 30일간 보관</strong>되며, 이후 시스템에서 자동으로 영구 파기됩니다.
                         </p>
                      </div>
                   </label>
                </div>
             </div>

             <div className="p-10 bg-bg-section/30 flex items-center space-x-4">
                <button 
                   onClick={() => setIsTermsOpen(false)}
                   className="px-8 py-5 bg-white border border-button-outline text-text-caption rounded-[2rem] font-black text-lg hover:bg-bg-section transition-all"
                >
                   취소
                </button>
                <button 
                   onClick={() => handleStart(true)}
                   className="flex-1 py-5 bg-primary text-white rounded-[2rem] font-black text-lg shadow-xl shadow-primary/20 hover:bg-primary-strong disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                   disabled={!termsAgreed.privacy || (isRequireCamera && !termsAgreed.camera) || !termsAgreed.retention}
                >
                   동의 완료 및 입장
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
