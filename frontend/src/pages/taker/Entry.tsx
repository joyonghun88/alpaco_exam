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
  
  // ?섍꼍 ?먭? ?곹깭
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const [cameraTerms, setCameraTerms] = useState('');
  const [standardTerms, setStandardTerms] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [searchParams] = useSearchParams();
  const systemReady = !isRequireCamera || hasCameraPermission;

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
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [waitingStartTime]);

  // ?쒖뒪???섍꼍 ?먭? (罹??꾩슜)
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
      alert('移대찓??沅뚰븳???뱀씤?댁빞 ?낆옣??媛?ν빀?덈떎. 釉뚮씪?곗? 二쇱냼李??쇱そ???먮Ъ???꾩씠肄섏쓣 ?뚮윭 沅뚰븳???덉슜??二쇱꽭??');
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
    
    // 2. ?쎄? ?숈쓽 ?뺤씤
    const isReadyForTerms = termsAgreed.privacy && (!isRequireCamera || termsAgreed.camera) && termsAgreed.retention;
    if (!isReadyForTerms) {
       setIsTermsOpen(true);
       return;
    }

    // 3. 移대찓???꾩닔 怨좎궗?μ씪 寃쎌슦 ?λ퉬 ?먭? ?뺤씤
    if (isRequireCamera && !hasCameraPermission) {
      alert('?섍꼍 ?먭????꾨즺?섏? ?딆븯?듬땲?? 移대찓?쇰? ?쒖꽦?뷀빐 二쇱꽭??');
      setIsTermsOpen(false); // 紐⑤떖 ?リ린 (?λ퉬 ?먭? ?좊룄)
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
        alert(`?몄쬆 ?ㅽ뙣: ${data.message || '?쒕쾭 ?ㅻ쪟'}`);
        return;
      }
      
      const requireCam = data.examRoom.isRequireCamera;
      setIsRequireCamera(requireCam);
      setStandardTerms(data.examRoom.standardTerms || '');
      setCameraTerms(data.examRoom.cameraTerms || '');

      if (requireCam) {
        if (!termsAgreed.camera) {
          setIsTermsOpen(true);
          if (!hasCameraPermission) startSystemCheck();
          return;
        }
        if (!hasCameraPermission) {
          setIsTermsOpen(true);
          startSystemCheck();
          return;
        }
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
      alert('?쒕쾭? ?곌껐?????놁뒿?덈떎.');
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
        
        {/* ?ㅻ챸 ?곸뿭 */}
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
              AI ?뚮뱶諛뺤뒪<br/>
              <span className="text-primary-strong">?섍꼍 ?먭? ?湲곗떎</span>
            </h1>
            <p className="text-text-body text-body-reading leading-relaxed opacity-80">
              ?쒗뿕 ?낆옣 ??移대찓???곹깭瑜??뺤씤??二쇱꽭?? <br/>
              ?ㅼ떆媛?紐⑤땲?곕쭅 ?쒖뒪?쒖? ?쒗뿕 以??섑뿕?앹쓽 ?댄깉 諛?遺?뺥뻾?꾨? 媛먯??섎ŉ, ??怨쇱젙???뱁솕?⑸땲??
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

        {/* ?먭? 移대뱶 ?곸뿭 */}
        <div className="lg:col-span-12 xl:col-span-7 flex flex-col justify-center">
          <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-atomic-gray-300/20 relative overflow-hidden">
             {/* ?곹깭 ?곷떒 ?ㅻ뜑 */}
            <div className="flex justify-between items-center mb-8 border-b border-atomic-gray-50 pb-6">
                <h3 className="text-2xl font-black text-text-title flex items-center space-x-3">
                  <MonitorPlay className="text-primary" size={28} />
                  <span>환경 점검</span>
                </h3>
               {systemReady && (
                  <div className="flex items-center space-x-2 bg-green-50 text-green-600 px-4 py-1.5 rounded-full text-xs font-black border border-green-200">
                     <CheckCircle2 size={14} />
                     <span>SYSTEM READY</span>
                  </div>
               )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
               {/* 왼쪽: 카메라(선택/필수) */}
               <div className="space-y-4">
                  {isRequireCamera ? (
                    <div className="relative aspect-[4/3] bg-black rounded-[2rem] overflow-hidden border-2 border-primary/20 shadow-xl group">
                       {!hasCameraPermission ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-bg-section cursor-pointer" onClick={startSystemCheck}>
                             <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-primary shadow-md group-hover:scale-110 transition-transform">
                                <Camera size={32} />
                             </div>
                             <p className="text-xs font-black text-text-title">카메라를 활성화해 주세요</p>
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
                             <div className="absolute inset-0 border-[30px] border-black/10 pointer-events-none" />
                             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-64 border-2 border-dashed border-white/40 rounded-full pointer-events-none" />
                          </>
                       )}
                    </div>
                  ) : (
                    <div className="relative aspect-[4/3] bg-bg-section rounded-[2rem] overflow-hidden border-2 border-button-outline shadow-xl flex flex-col items-center justify-center gap-3">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-text-caption shadow-md">
                        <VideoOff size={32} />
                      </div>
                      <p className="text-xs font-black text-text-title">이 고사장은 카메라 모니터링이 없습니다</p>
                      <p className="text-[10px] font-bold text-text-caption">카메라 권한 없이도 입장할 수 있어요.</p>
                    </div>
                  )}
                  
                  <div className="bg-bg-section p-5 rounded-2xl border border-button-outline flex items-center space-x-4">
                      {isRequireCamera ? (
                        <>
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                             <ShieldCheck size={20} />
                          </div>
                          <div>
                             <p className="text-[11px] font-black text-text-title">AI Proctoring Enabled</p>
                             <p className="text-[10px] font-bold text-text-caption">시험 공정성과 보안을 위해 카메라 모니터링이 진행됩니다.</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-full bg-text-caption/10 flex items-center justify-center text-text-caption">
                             <VideoOff size={20} />
                          </div>
                          <div>
                             <p className="text-[11px] font-black text-text-title">Camera Not Required</p>
                             <p className="text-[10px] font-bold text-text-caption">이 고사장은 카메라 모니터링 없이 진행됩니다.</p>
                          </div>
                        </>
                      )}
                  </div>
               </div>
               {/* ?ㅻⅨ履? 肄붾뱶 ?낅젰 諛??숈쓽 */}
               <div className="flex flex-col justify-between">
                  <div className="space-y-6">
                     <div className="relative">
                        <label className="block text-xs font-black text-text-caption uppercase mb-3 ml-1">珥덈? 肄붾뱶 (Invitation)</label>
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
                           <AlertTriangle size={16} /> 遺?뺥뻾??諛⑹? ?쒖빟
                        </h4>
                        <p className="text-text-caption text-xs font-bold leading-relaxed">
                           ?쒗뿕 以??꾩껜?붾㈃ ?댄깉, 罹?媛?? ?먮━ 鍮꾩? ?깆? 遺?뺥뻾?꾨줈 媛꾩＜?섎ŉ 利됱떆 媛먮룆愿?먭쾶 寃쎄퀬 ?뚮┝??李⑤떒?⑸땲??
                        </p>
                        <label className="flex items-center space-x-3 bg-white p-4 rounded-2xl border border-button-outline cursor-pointer hover:border-primary transition-all shadow-sm">
                           <input 
                               type="checkbox" 
                               checked={isChecked}
                               onChange={() => setIsChecked(!isChecked)}
                               className="w-5 h-5 text-primary rounded-lg focus:ring-primary border-button-outline"
                           />
                           <span className="text-xs text-text-title font-black">안내사항 확인 및 동의</span>
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
                        肄붾뱶 ?ㅼ떆 ?낅젰 (痍⑥냼)
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
                     <span>{isRequireCamera && !hasCameraPermission ? '?λ퉬 ?먭? ?꾩슂' : '?됯? ?쒖옉?섍린'}</span>
                     <ArrowRight size={24} strokeWidth={3} />
                  </button>
                  )}
               </div>
            </div>

            {/* ?섎떒 ?먭? 由ъ뒪???꾩씠肄?*/}
             <div className="flex items-center justify-center space-x-10 pt-4 border-t border-atomic-gray-50">
                <div className={`flex items-center space-x-2 text-[10px] font-black ${isRequireCamera ? (hasCameraPermission ? 'text-primary' : 'text-text-caption') : 'text-text-caption'}`}>
                   {isRequireCamera ? (hasCameraPermission ? <Video size={14} /> : <VideoOff size={14} />) : <VideoOff size={14} />}
                   <span>{isRequireCamera ? 'SECURE CAMERA-ONLY FEED' : 'CAMERA NOT REQUIRED'}</span>
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

      {/* 媛쒖씤?뺣낫 諛?蹂댁븞 ?숈쓽 紐⑤떖 */}
      {isTermsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-text-title/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-button-outline">
             <div className="p-10 border-b border-button-outline flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-3 mb-4">
                     <ShieldCheck size={32} className="text-primary" />
                     <h2 className="text-3xl font-black text-text-title">媛쒖씤?뺣낫 ?섏쭛 諛?蹂댁븞 ?숈쓽</h2>
                  </div>
                  <p className="text-sm text-text-caption font-bold">?됯???怨듭젙?깃낵 ?곗씠??蹂댄샇瑜??꾪빐 ?ㅼ쓬 ?ы빆??????숈쓽媛 ?꾩슂?⑸땲??</p>
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
                            媛쒖씤?뺣낫 ?섏쭛 諛??댁슜 ?숈쓽 (?꾩닔)
                             <span className="ml-2 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded">PIPA 준수</span>
                          </p>
                         <p className="text-[11px] text-text-body font-medium leading-relaxed">
                            {standardTerms || '?쒗뿕 蹂몄씤 ?뺤씤 諛?遺?뺥뻾??諛⑹?瑜??꾪빐 ?깅챸, ?대찓???뺣낫瑜??섏쭛?⑸땲?? ?섏쭛???뺣낫??蹂??됯? 紐⑹쟻 ?댁쇅???⑸룄濡??ъ슜?섏? ?딆뒿?덈떎.'}
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
                            ?곸긽 ?뺣낫(?뱀뭅硫붾씪) ?섏쭛 ?숈쓽 (?꾩닔)
                            <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded">?ㅼ떆媛??뱁솕</span>
                         </p>
                         <p className="text-[11px] text-text-body font-medium leading-relaxed">
                            {cameraTerms || '?ㅼ떆媛?媛먮룆???꾪빐 ?쒗뿕 以??섑뿕?앹쓽 ?덈㈃ 諛?二쇰? ?섍꼍 ?곸긽???섏쭛 諛???ν빀?덈떎. 蹂??쒖뒪?쒖? ?ъ깮??蹂댄샇瑜??꾪빐 ?뚯꽦(留덉씠??? ?섏쭛?섏? ?딆뒿?덈떎.'}
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
                            ?곗씠??蹂댁쑀 湲곌컙 諛??먮룞 ?뚭린 ?숈쓽 (?꾩닔)
                            <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded">30?????먮룞 ??젣</span>
                         </p>
                         <p className="text-[11px] text-text-body font-medium leading-relaxed">
                            ?섏쭛???곸긽 諛?濡쒓렇??寃곌낵 ?뺤젙 諛??댁쓽 ?쒓린 湲곌컙 怨좊젮瑜??꾪빐 <strong>?쒗뿕 醫낅즺?쇰줈遺??30?쇨컙 蹂닿?</strong>?섎ŉ, ?댄썑 ?쒖뒪?쒖뿉???먮룞?쇰줈 ?곴뎄 ?뚭린?⑸땲??
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
                   痍⑥냼
                </button>
                <button 
                   onClick={() => handleStart(true)}
                   className="flex-1 py-5 bg-primary text-white rounded-[2rem] font-black text-lg shadow-xl shadow-primary/20 hover:bg-primary-strong disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                   disabled={!termsAgreed.privacy || (isRequireCamera && !termsAgreed.camera) || !termsAgreed.retention}
                >
                   ?숈쓽 ?꾨즺 諛??낆옣
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
