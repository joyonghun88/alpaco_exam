import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Users, FileSpreadsheet, Send, Trash2, RefreshCcw, Link2, Check, ChevronRight, LayoutList, Building2, X, Download, UploadCloud } from 'lucide-react';
import { API_BASE_URL } from '../../config';

interface Room {
  id: string;
  roomName: string;
  exam: { title: string };
  _count: { participants: number };
}

interface Participant {
  id: string;
  name: string;
  email: string;
  invitationCode: string;
  roomId: string;
  room: { roomName: string };
}

export default function Participants() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const participantFileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [targetRoomId, setTargetRoomId] = useState('');
  
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [inviteTargetIds, setInviteTargetIds] = useState<string[] | null>(null);
  const [emailTemplate, setEmailTemplate] = useState(`안녕하세요 {{name}}님
아래 [{{room}}] 방에 배정되었습니다.

- 초대 코드: {{code}}
- 접속 링크: {{link}}

감사합니다.`);

  const authHeader = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` };

  const fetchData = async () => {
    try {
      const [resR, resP] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/rooms`, { headers: authHeader }),
        fetch(`${API_BASE_URL}/admin/participants`, { headers: authHeader })
      ]);
      if (resR.ok) setRooms(await resR.json());
      if (resP.ok) setParticipants(await resP.json());
    } catch {}
  };

  useEffect(() => { fetchData(); }, []);

  // ?좏깮??怨좎궗?μ뿉 ?곕Ⅸ ?꾪꽣留? 

  const filteredParticipants = useMemo(() => {
    if (!selectedRoomId) return [];
    return participants.filter(p => p.roomId === selectedRoomId);
  }, [participants, selectedRoomId]);

  const handleAdd = async (e: any) => {
    e.preventDefault();
    if (!name || !email || !targetRoomId) return alert('이름/이메일/평가방을 모두 입력해주세요.');
    try {
      const res = await fetch(`${API_BASE_URL}/admin/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ name, email, roomId: targetRoomId })
      });
      if (res.ok) {
        setName(''); setEmail(''); fetchData();
      }
    } catch {}
  };

  const handleBulkAdd = async () => {
    if (!bulkText || !targetRoomId) return alert('CSV 텍스트와 평가방을 선택해주세요.');
    
    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.includes(',') && l.length > 5);
    const ps = lines.map(l => {
      const parts = l.split(',');
      return { 
        name: parts[0]?.trim() || '이름없음', 
        email: parts[1]?.trim() || 'no-email@example.com' 
      };
    }).filter(p => p.email.includes('@')); // 理쒖냼???대찓???뺤떇??媛뽰텣 寃껊쭔

    if (ps.length === 0) return alert('유효한 데이터가 없습니다. [이름, 이메일] 형식으로 입력해주세요.');

    try {
      const res = await fetch(`${API_BASE_URL}/admin/participants/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ roomId: targetRoomId, participants: ps })
      });
      if (res.ok) {
        setBulkText(''); setShowBulk(false); fetchData();
        alert(`${ps.length}명 등록되었습니다.`);
      } else {
        const err = await res.json();
        alert(`등록 실패: ${err.message || '알 수 없는 오류'}`);
      }
    } catch {
      alert('등록 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/participants/${id}`, { 
        method: 'DELETE',
        headers: authHeader
      });
      if (res.ok) fetchData();
    } catch {}
  };

  const handleFileUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { 
      setBulkText(event.target?.result as string); 
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const csvContent = 
      "이름,이메일\n" +
      "홍길동,hong@example.com\n" +
      "김철수,kim@alpaco.io\n" +
      "박영희,park@dx.com";
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "participant_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyLink = (code: string, id: string) => {
    const url = `${window.location.origin}/exam?code=${code}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInvite = (id: string) => {
    setInviteTargetIds([id]);
    setShowBulkInvite(true);
  };

  const handleBulkInvite = async () => {
    if (!selectedRoomId) return;

    const targetIds = inviteTargetIds ?? filteredParticipants.map(p => p.id);
    if (targetIds.length === 0) return;

    const confirmText = inviteTargetIds
      ? `${targetIds.length}명에게 초대코드를 발송하시겠습니까?`
      : `${targetIds.length}명에게 일괄 발송하시겠습니까?`;

    if (!confirm(confirmText)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/participants/invite-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ participantIds: targetIds, template: emailTemplate })
      });

      if (res.ok) {
        alert(inviteTargetIds ? '발송이 완료되었습니다.' : '일괄 발송이 완료되었습니다.');
        setShowBulkInvite(false);
        setInviteTargetIds(null);
      } else {
        const err = await res.json().catch(() => ({} as any));
        alert(`발송 실패: ${err.message || res.status}`);
      }
    } catch {
      alert('발송 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-32">
      {/* ?ㅻ뜑 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-button-outline pb-8">
        <div className="animate-in fade-in duration-700">
          <div className="flex items-center space-x-2 text-primary font-black text-sm uppercase tracking-widest mb-2">
             <Building2 size={16} /> <span>Room Allocation Management</span>
          </div>
          <h1 className="text-4xl font-black text-text-title tracking-tight flex items-center">
             ?섑뿕??諛곗젙 愿由?             {selectedRoomId && (
               <span className="flex items-center text-primary-strong ml-4">
                 <ChevronRight className="mx-2 text-atomic-gray-200" /> {rooms.find(r=>r.id === selectedRoomId)?.roomName}
               </span>
             )}
          </h1>
          <p className="text-text-caption mt-2 font-medium">怨좎궗?λ퀎濡??섑뿕踰덊샇瑜?諛쒓툒?섍퀬 紐낅떒??愿由ы빀?덈떎.</p>
        </div>
        <div className="flex space-x-3">
           {selectedRoomId && (
             <div className="flex space-x-2">
               <button 
                 onClick={() => { setInviteTargetIds(null); setShowBulkInvite(true); }}
                 className="px-6 py-4 bg-primary/10 text-primary border border-primary/20 rounded-2xl font-black flex items-center space-x-2 hover:bg-primary hover:text-white transition-all shadow-sm"
               >
                  <Send size={20} />
                  <span>?쇨큵 珥덈? 諛쒓툒</span>
               </button>
               <button 
                 onClick={() => {
                   setTargetRoomId(selectedRoomId);
                   setShowBulk(true);
                 }} 
                 className="px-6 py-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-2xl font-black flex items-center space-x-2 hover:bg-emerald-100 transition-all shadow-sm"
               >
                  <FileSpreadsheet size={20} />
                  <span>?묒? ???諛곗젙</span>
               </button>
             </div>
           )}
           <button onClick={fetchData} className="p-4 bg-white border border-button-outline rounded-2xl hover:bg-bg-section transition shadow-sm">
              <RefreshCcw size={20} className="text-text-caption" />
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        {/* ?ъ씠?쒕컮: 怨좎궗???좏깮 由ъ뒪??*/}
        <div className="xl:col-span-4">
           <div className="space-y-4">
              <h2 className="text-sm font-black text-text-caption uppercase tracking-widest pl-2 mb-4">怨좎궗?λ퀎 諛곗젙 ?꾪솴</h2>
              {rooms.map(room => (
                <button 
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  className={`w-full text-left p-6 rounded-[2rem] border-2 transition-all group relative overflow-hidden active:scale-95 ${selectedRoomId === room.id ? 'bg-primary border-primary shadow-xl scale-[1.02]' : 'bg-bg-default border-button-outline hover:border-primary/50'}`}
                >
                  <div className={`absolute -right-4 -bottom-4 opacity-10 group-hover:scale-125 transition-transform ${selectedRoomId === room.id ? 'text-white' : 'text-primary'}`}>
                     <LayoutList size={120} />
                  </div>
                  <div className="relative z-10">
                     <h3 className={`text-xl font-black leading-tight ${selectedRoomId === room.id ? 'text-white' : 'text-text-title'}`}>{room.roomName}</h3>
                     <p className={`text-xs mt-1 font-bold ${selectedRoomId === room.id ? 'text-white/70' : 'text-text-caption'}`}>{room.exam.title}</p>
                     <div className="mt-8 flex items-center justify-between">
                        <div className={`flex items-center space-x-2 text-sm font-black ${selectedRoomId === room.id ? 'text-white' : 'text-primary'}`}>
                           <Users size={16} />
                           <span>{room._count.participants}紐?諛곗젙</span>
                        </div>
                        {selectedRoomId === room.id && <Check className="text-white animate-in zoom-in" />}
                     </div>
                  </div>
                </button>
              ))}
              {rooms.length === 0 && (
                <div className="p-10 text-center bg-bg-section rounded-[2rem] border-2 border-dashed border-button-outline text-text-caption font-bold">
                   ?깅줉??怨좎궗?μ씠 ?놁뒿?덈떎.
                </div>
              )}
           </div>
        </div>

        {/* 硫붿씤 ?곸뿭: ?섑뿕???곸꽭 紐낅떒 + 異붽? ??*/}
        <div className="xl:col-span-8 space-y-8">
           {!selectedRoomId ? (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-bg-section/30 rounded-[3rem] border-2 border-dashed border-button-outline animate-in fade-in duration-500">
                 <Building2 size={64} className="text-atomic-gray-200 mb-6" />
                 <h3 className="text-xl font-black text-text-caption">醫뚯륫?먯꽌 愿由ы븷 怨좎궗?μ쓣 ?좏깮?섏꽭??</h3>
                 <p className="text-text-caption font-medium mt-2">怨좎궗?λ퀎濡??섑뿕踰덊샇瑜?蹂꾨룄濡?愿由ы븷 ???덉뒿?덈떎.</p>
              </div>
           ) : (
             <div className="space-y-8 animate-in slide-in-from-right-10 duration-500">
                {/* ?섑뿕??異붽? ??(?대떦 怨좎궗???꾩슜) */}
                <div className="bg-bg-default border border-button-outline rounded-[2.5rem] p-10 shadow-lg relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[4rem] flex items-center justify-center">
                      <Plus className="text-primary/30" size={40} />
                   </div>
                   <h2 className="text-2xl font-black text-text-title mb-8 flex items-center space-x-2">
                       <span>{rooms.find(r=>r.id === selectedRoomId)?.roomName} ?좉퇋 諛곗젙</span>
                   </h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <input value={name} onChange={e=>setName(e.target.value)} placeholder="?섑뿕???대쫫" className="w-full bg-bg-section border-2 border-button-outline p-5 rounded-2xl text-lg font-bold outline-none focus:border-primary transition" />
                      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="?대찓??(ID)" className="w-full bg-bg-section border-2 border-button-outline p-5 rounded-2xl text-lg font-bold outline-none focus:border-primary transition" />
                   </div>
                   <button onClick={() => { setTargetRoomId(selectedRoomId); handleAdd({ preventDefault: ()=>{} } as any); }} className="w-full bg-primary hover:bg-primary-strong text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95 text-lg">
                      ?섑뿕??紐낅떒??異붽??섍린
                   </button>
                   <div className="mt-4 text-center">
                      <button 
                        onClick={() => { setTargetRoomId(selectedRoomId); setShowBulk(true); }}
                        className="text-xs font-black text-text-caption hover:text-primary transition-colors flex items-center justify-center space-x-1 mx-auto"
                      >
                         <FileSpreadsheet size={14} /> <span>?먮뒗 ?묒? ?곗씠?곕줈 ???諛곗젙?섍린</span>
                      </button>
                   </div>
                </div>

                {/* ?곸꽭 紐낅떒 由ъ뒪??*/}
                <div className="space-y-4">
                   <div className="flex justify-between items-center px-4">
                      <h2 className="font-black text-text-title flex items-center space-x-2">
                         <LayoutList size={18} className="text-primary" />
                         <span>諛쒓툒???섑뿕??由ъ뒪</span>
                      </h2>
                      <span className="text-xs font-black text-text-caption uppercase">{filteredParticipants.length} Participants</span>
                   </div>
                   {filteredParticipants.map(person => (
                     <div key={person.id} className="group bg-bg-default border border-button-outline rounded-[2rem] p-8 hover:shadow-2xl transition-all flex justify-between items-center relative overflow-hidden">
                        <div className="flex-1">
                           <div className="flex items-center space-x-3 mb-2">
                              <span className="text-xs font-black text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 tracking-tighter">
                                 {person.invitationCode}
                              </span>
                           </div>
                           <h4 className="text-2xl font-black text-text-title">{person.name}</h4>
                           <p className="text-text-caption font-bold mt-1">{person.email}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button 
                              onClick={() => handleInvite(person.id)}
                              className="p-4 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all shadow-sm flex items-center space-x-2 group-hover:scale-105"
                              title="珥덈? ?대찓??諛쒖넚"
                            >
                               <Send size={18} />
                            </button>
                            <button 
                              onClick={() => copyLink(person.invitationCode, person.id)} 
                              className={`p-4 rounded-2xl transition-all flex items-center space-x-2 font-black text-sm active:scale-90 ${copiedId === person.id ? 'bg-emerald-500 text-white shadow-emerald-200 shadow-xl' : 'bg-bg-section text-text-caption hover:bg-button-hover'}`}
                            >
                               {copiedId === person.id ? <Check size={18} /> : <Link2 size={18} />}
                               <span>{copiedId === person.id ? 'Copied' : 'Direct Link'}</span>
                            </button>
                            <button onClick={() => handleDelete(person.id)} className="p-4 bg-red-50 text-red-300 hover:text-white hover:bg-red-500 rounded-2xl transition-all shadow-sm">
                               <Trash2 size={20} />
                            </button>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
           )}
        </div>
      </div>

      {/* ????깅줉 紐⑤떖 (?ㅻ쾭?덉씠) */}
      {showBulk && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 pb-20 overflow-auto">
           <div className="bg-bg-default w-full max-w-4xl border-2 border-primary/20 rounded-[4rem] p-12 shadow-[0_0_100px_rgba(0,0,0,0.2)] animate-in zoom-in-95 relative">
              <button onClick={()=>setShowBulk(false)} className="absolute top-10 right-10 p-4 hover:bg-bg-section rounded-3xl transition"><X size={32} /></button>
              <h2 className="text-4xl font-black mb-4 tracking-tighter">?묒? ?곗씠???쇨큵 諛곗젙</h2>
              <p className="text-text-caption mb-10 font-bold">???怨좎궗?μ쓣 ?좏깮?섍퀬 CSV ?곗씠?곕? 遺숈뿬?ｌ쑝?몄슂.</p>
              
              <div className="space-y-8">
                  {!selectedRoomId ? (
                    <div>
                       <label className="text-[11px] font-black text-text-caption uppercase tracking-widest pl-2 mb-4 block">1. ???怨좎궗???좏깮</label>
                       <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {rooms.map(r => (
                            <button key={r.id} onClick={()=>setTargetRoomId(r.id)} className={`p-4 rounded-2xl border-2 font-black text-xs transition-all ${targetRoomId === r.id ? 'bg-primary border-primary text-white' : 'bg-bg-section border-button-outline text-text-caption hover:border-primary/50'}`}>
                               {r.roomName}
                            </button>
                          ))}
                       </div>
                    </div>
                  ) : (
                    <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10">
                       <p className="text-sm font-black text-primary flex items-center">
                          <Check size={18} className="mr-2" /> 
                          {rooms.find(r=>r.id === selectedRoomId)?.roomName} (??濡??먮룞 諛곗젙?⑸땲??
                       </p>
                    </div>
                  )}
                  <div>
                     <div className="flex justify-between items-end mb-4">
                        <label className="text-[11px] font-black text-text-caption uppercase tracking-widest pl-2 block">{selectedRoomId ? '1. ?섑뿕??紐낅떒 ?뚯떛 (CSV)' : '2. ?섑뿕??紐낅떒 ?뚯떛 (CSV)'}</label>
                        <button 
                          onClick={() => participantFileInputRef.current?.click()}
                          className="flex items-center space-x-2 text-xs font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl hover:bg-emerald-100 transition shadow-sm"
                        >
                           <UploadCloud size={14} /> <span>CSV ?뚯씪 遺덈윭?ㅺ린</span>
                        </button>
                        <input type="file" ref={participantFileInputRef} onChange={handleFileUpload} accept=".csv,.txt" className="hidden" />
                     </div>
                     <textarea value={bulkText} onChange={e=>setBulkText(e.target.value)} className="w-full h-64 bg-bg-section border-2 border-button-outline rounded-[2.5rem] p-8 font-mono text-sm focus:border-primary outline-none shadow-inner" placeholder="?대쫫, ?대찓??(?? ?띻만?? hong@example.com)" />
                    <button onClick={handleDownloadTemplate} className="mt-4 flex items-center space-x-2 text-xs font-black text-primary hover:underline">
                       <Download size={14} /> <span>???諛곗젙???섑뵆 ?묒떇 ?ㅼ슫濡쒕뱶</span>
                    </button>
                 </div>
                 <button onClick={handleBulkAdd} className="w-full bg-emerald-600 text-white py-6 rounded-3xl font-black text-xl shadow-2xl hover:bg-emerald-700 transition active:scale-95">???諛쒓툒 諛?諛곗젙 ?ㅽ뻾</button>
              </div>
           </div>
        </div>
      )}
      {/* ?쇨큵 珥덈? 諛쒖넚 紐⑤떖 */}
      {showBulkInvite && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 pb-20 overflow-auto">
           <div className="bg-bg-default w-full max-w-3xl border-2 border-primary/20 rounded-[4rem] p-12 shadow-2xl animate-in zoom-in-95 relative">
              <button onClick={()=>setShowBulkInvite(false)} className="absolute top-10 right-10 p-4 hover:bg-bg-section rounded-3xl transition"><X size={32} /></button>
              <h2 className="text-4xl font-black mb-4 tracking-tighter">?쇨큵 珥덈? 硫붿떆吏 ?몄쭛</h2>
              <p className="text-text-caption mb-10 font-bold">
                怨좎궗????紐⑤뱺 ?섑뿕??{filteredParticipants.length}紐??먭쾶 蹂대궪 硫붿떆吏瑜??묒꽦?섏꽭??
              </p>

              <div className="space-y-6">
                 <div>
                   <label className="text-[11px] font-black text-text-caption uppercase tracking-widest pl-2 mb-2 block">硫붿떆吏 ?쒗뵆由?</label>
                   <textarea 
                     value={emailTemplate} 
                     onChange={e=>setEmailTemplate(e.target.value)}
                     className="w-full h-80 bg-bg-section border-2 border-button-outline rounded-[2.5rem] p-8 font-medium text-lg focus:border-primary outline-none shadow-inner leading-relaxed"
                     placeholder="硫붿떆吏 ?댁슜???낅젰?섏꽭??"
                   />
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-primary/5 rounded-2xl text-[11px] font-bold text-primary">
                       ?ъ슜 媛??移섑솚??<br/>
                       {`{{name}}`}: ?섑뿕???대쫫<br/>
                       {`{{room}}`}: 怨좎궗??紐낆묶
                    </div>
                    <div className="p-4 bg-primary/5 rounded-2xl text-[11px] font-bold text-primary">
                       ?ъ슜 媛??移섑솚??<br/>
                       {`{{code}}`}: 珥덈? 肄붾뱶<br/>
                       {`{{link}}`}: ?묒냽 URL
                    </div>
                 </div>

                 <button onClick={handleBulkInvite} className="w-full bg-primary text-white py-6 rounded-3xl font-black text-xl shadow-2xl hover:bg-primary-strong transition active:scale-95">
                    {filteredParticipants.length}紐낆뿉寃??쇨큵 ?꾩넚 ?쒖옉
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
