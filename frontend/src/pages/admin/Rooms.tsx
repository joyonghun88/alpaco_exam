import { useState, useEffect } from 'react';
import { Plus, Monitor, Calendar, Clock, Trash2, Users, FileText, CheckCircle2, ChevronDown, ChevronUp, RefreshCcw, Building, Target, X, Video, Edit2, Check } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Room {
  id: string;
  roomName: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: string;
  isRequireCamera: boolean;
  exam: {
    title: string;
    description: string;
    questions: { question: { category: string, content: any, type: string }, point: number, orderNum: number }[];
  };
  _count: { participants: number };
}

export default function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [form, setForm] = useState({ examId: '', roomName: '', durationMinutes: 60, startAt: '', isRequireCamera: false });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewRoom, setPreviewRoom] = useState<Room | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ roomName: '', durationMinutes: 60, startAt: '', isRequireCamera: false });

  const authHeader = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` };

  const fetchData = async () => {
    try {
      const [rRes, eRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/rooms`, { headers: authHeader }),
        fetch(`${API_BASE_URL}/admin/exams`, { headers: authHeader })
      ]);
      if (rRes.ok) setRooms(await rRes.json());
      if (eRes.ok) setExams(await eRes.json());
    } catch {}
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.examId || !form.roomName) return alert('정보를 모두 입력하세요.');
    try {
      const res = await fetch(`${API_BASE_URL}/admin/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setForm({ examId: '', roomName: '', durationMinutes: 60, startAt: '', isRequireCamera: false });
        fetchData();
      }
    } catch {}
  };

  const getLocalISO = (dateStr: string) => {
    const d = new Date(dateStr);
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset);
    return local.toISOString().slice(0, 16);
  };

  const startEdit = (room: Room) => {
    setEditingId(room.id);
    setEditForm({
      roomName: room.roomName,
      durationMinutes: room.durationMinutes,
      startAt: getLocalISO(room.startAt),
      isRequireCamera: room.isRequireCamera
    });
  };

  const handleUpdate = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/rooms/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        setEditingId(null);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.message || '수정에 실패했습니다.');
      }
    } catch {
      alert('네트워크 오류가 발생했습니다.');
    }
  };

  const deleteRoom = async (id: string) => {
    if (!confirm('고사장을 삭제하시겠습니까? 관련 데이터가 모두 소실됩니다.')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/rooms/${id}`, {
        method: 'DELETE',
        headers: authHeader
      });
      if (res.ok) fetchData();
    } catch {}
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('ko-KR', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex justify-between items-end border-b border-button-outline pb-6">
        <div>
           <h1 className="text-4xl font-black text-text-title tracking-tighter mb-2">Room Management</h1>
           <p className="text-text-caption font-bold flex items-center">
              <Building size={16} className="mr-2" /> 각 시험 대기실 및 고사장 환경을 중앙 제어합니다.
           </p>
        </div>
        <button onClick={fetchData} className="p-3 bg-white border border-button-outline rounded-2xl hover:bg-bg-section transition-colors shadow-sm">
           <RefreshCcw size={20} className="text-text-caption" />
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        {/* 고사장 생성 폼 */}
        <div className="xl:col-span-4">
           <div className="bg-bg-default border border-button-outline rounded-[2.5rem] p-10 shadow-xl sticky top-10">
              <h2 className="text-2xl font-black text-text-title mb-8 flex items-center space-x-3">
                 <Plus className="bg-primary text-white p-1 rounded-xl" size={24} />
                 <span>신규 고사장 개설</span>
              </h2>
              <form onSubmit={handleCreate} className="space-y-6">
                 <div>
                    <label className="block text-[11px] font-black text-text-caption uppercase mb-3 ml-2 tracking-widest">배정 기출 마스터</label>
                    <select 
                      value={form.examId} 
                      onChange={e=>setForm({...form, examId: e.target.value})}
                      className="w-full bg-bg-section border-2 border-button-outline rounded-2xl py-4 px-6 text-sm font-black focus:border-primary outline-none transition cursor-pointer"
                    >
                       <option value="">-- 시험지 선택 --</option>
                       {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-[11px] font-black text-text-caption uppercase mb-3 ml-2 tracking-widest">고사장 명칭</label>
                    <input 
                      value={form.roomName} 
                      onChange={e=>setForm({...form, roomName: e.target.value})}
                      placeholder="예: 서울 강남 제1고사장"
                      className="w-full bg-bg-section border-2 border-button-outline rounded-2xl py-4 px-6 text-sm font-bold focus:border-primary outline-none transition"
                    />
                 </div>
                 <div>
                    <label className="block text-[11px] font-black text-text-caption uppercase mb-3 ml-2 tracking-widest">제한 시간 (분)</label>
                    <input 
                      type="number"
                      value={form.durationMinutes} 
                      onChange={e=>setForm({...form, durationMinutes: Number(e.target.value)})}
                      className="w-full bg-bg-section border-2 border-button-outline rounded-2xl py-4 px-6 text-sm font-black focus:border-primary outline-none transition"
                    />
                 </div>
                 <div>
                    <label className="block text-[11px] font-black text-text-caption uppercase mb-3 ml-2 tracking-widest">오픈 예정 시각 (미입력시 즉시)</label>
                    <input 
                      type="datetime-local"
                      value={form.startAt} 
                      onChange={e=>setForm({...form, startAt: e.target.value})}
                      className="w-full bg-bg-section border-2 border-button-outline rounded-2xl py-4 px-6 text-sm font-bold focus:border-primary outline-none transition"
                    />
                 </div>

                 <div className="pt-4 border-t border-button-outline">
                    <label className="flex items-center space-x-3 cursor-pointer group p-4 bg-bg-section/50 rounded-2xl border border-button-outline hover:border-primary transition-all">
                       <input 
                         type="checkbox"
                         checked={form.isRequireCamera}
                         onChange={e=>setForm({...form, isRequireCamera: e.target.checked})}
                         className="w-5 h-5 text-primary rounded-lg border-button-outline focus:ring-primary transition-all cursor-pointer"
                       />
                       <div>
                          <p className="text-sm font-black text-text-title flex items-center">
                             <Video size={16} className="mr-1.5 text-primary" /> 카메라 모니터링 강제
                          </p>
                          <p className="text-[10px] text-text-caption font-bold">응시자가 캠을 켜야만 입장이 가능합니다.</p>
                       </div>
                    </label>
                 </div>

                 <button className="w-full bg-primary text-white py-5 rounded-[2rem] font-black text-lg hover:bg-primary-strong transition shadow-lg shadow-primary/20 transform hover:-translate-y-1">
                    고사장 생성하기
                 </button>
              </form>
           </div>
        </div>

        {/* 고사장 리스트 */}
        <div className="xl:col-span-8 space-y-6">
           {rooms.length === 0 && (
             <div className="bg-white border-2 border-dashed border-button-outline rounded-[3rem] p-20 text-center">
                <p className="text-text-caption font-black text-lg">개설된 고사장이 없습니다.</p>
             </div>
           )}
           {rooms.map(room => (
             <div key={room.id} className="bg-white border border-button-outline rounded-[3rem] overflow-hidden shadow-sm hover:shadow-xl transition-all group">
                <div className="p-10">
                   <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center space-x-4">
                         <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                           room.status === 'IN_PROGRESS' ? 'bg-primary text-white animate-pulse' :
                           room.status === 'READY' ? 'bg-bg-section text-text-caption border border-button-outline' :
                           'bg-text-title text-white outline outline-4 outline-bg-section'
                         }`}>
                           {room.status}
                         </div>
                         {editingId === room.id ? (
                           <div className="flex items-center space-x-3">
                             <input 
                               value={editForm.roomName}
                               onChange={e => setEditForm({...editForm, roomName: e.target.value})}
                               className="text-2xl font-black text-primary bg-bg-section border-b-2 border-primary outline-none px-2 py-1 rounded-t-lg"
                               autoFocus
                             />
                             <label className="flex items-center space-x-2 cursor-pointer bg-bg-section px-3 py-1 rounded-xl border border-button-outline">
                                <input 
                                  type="checkbox"
                                  checked={editForm.isRequireCamera}
                                  onChange={e => setEditForm({...editForm, isRequireCamera: e.target.checked})}
                                  className="w-4 h-4 text-primary rounded"
                                />
                                <span className="text-[10px] font-black text-text-caption flex items-center"><Video size={12} className="mr-1" /> 카메라 필수</span>
                             </label>
                           </div>
                         ) : (
                           <div className="flex items-center space-x-3">
                             <h3 className="text-2xl font-black text-text-title group-hover:text-primary transition-colors">{room.roomName}</h3>
                             <div className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-[10px] font-black ${room.isRequireCamera ? 'bg-primary/10 text-primary' : 'bg-bg-section text-text-caption border border-button-outline opacity-40'}`}>
                               <Video size={14} />
                               <span>{room.isRequireCamera ? 'CAM ON' : 'CAM OFF'}</span>
                             </div>
                           </div>
                         )}
                      </div>
                      <div className="flex items-center space-x-2">
                         {editingId === room.id ? (
                           <>
                             <button 
                               onClick={() => handleUpdate(room.id)}
                               className="p-3 bg-primary text-white rounded-2xl hover:bg-primary-strong transition-all shadow-lg shadow-primary/20"
                               title="저장"
                             >
                                <Check size={20} />
                             </button>
                             <button 
                               onClick={() => setEditingId(null)}
                               className="p-3 bg-bg-section text-text-caption rounded-2xl hover:bg-button-outline transition-colors"
                               title="취소"
                             >
                                <X size={20} />
                             </button>
                           </>
                         ) : (
                           room.status === 'READY' && (
                             <button 
                               onClick={() => startEdit(room)}
                               className="p-3 bg-bg-section text-text-title rounded-2xl hover:bg-primary hover:text-white transition-all"
                               title="정보 수정"
                             >
                                <Edit2 size={20} />
                             </button>
                           )
                         )}
                         <button 
                           onClick={() => setExpandedId(expandedId === room.id ? null : room.id)}
                           className="p-3 bg-bg-section rounded-2xl hover:bg-button-outline transition-colors"
                         >
                            {expandedId === room.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                         </button>
                         <button 
                           onClick={() => deleteRoom(room.id)}
                           className="p-3 bg-red-50 text-red-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all"
                         >
                            <Trash2 size={20} />
                         </button>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                      <div className="space-y-1">
                         <p className="text-[10px] font-black text-text-caption uppercase tracking-widest flex items-center"><FileText size={12} className="mr-1" /> 시험 코드</p>
                         <p className="text-sm font-bold text-text-title">{room.exam.title}</p>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[10px] font-black text-text-caption uppercase tracking-widest flex items-center"><Users size={12} className="mr-1" /> 배정 인원</p>
                         <p className="text-sm font-black text-primary">{room._count.participants}명</p>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[10px] font-black text-text-caption uppercase tracking-widest flex items-center"><Clock size={12} className="mr-1" /> 시험 시간</p>
                         {editingId === room.id ? (
                           <div className="flex items-center space-x-1">
                             <input 
                               type="number"
                               value={editForm.durationMinutes}
                               onChange={e => setEditForm({...editForm, durationMinutes: Number(e.target.value)})}
                               className="w-16 bg-bg-section border border-primary rounded px-2 py-1 text-sm font-black outline-none"
                             />
                             <span className="text-xs font-bold text-text-caption">분</span>
                           </div>
                         ) : (
                           <p className="text-sm font-bold text-text-title">{room.durationMinutes}분</p>
                         )}
                      </div>
                      <div className="space-y-1">
                         <p className="text-[10px] font-black text-text-caption uppercase tracking-widest flex items-center"><CheckCircle2 size={12} className="mr-1" /> 문항 수</p>
                         <p className="text-sm font-bold text-text-title">{room.exam.questions.length}문항</p>
                      </div>
                   </div>

                   <div className="flex items-center space-x-6 text-[11px] font-bold text-text-caption">
                      <div className="flex items-center">
                        <Calendar size={14} className="mr-1.5 opacity-50" /> 
                        {editingId === room.id ? (
                           <input 
                             type="datetime-local"
                             value={editForm.startAt}
                             onChange={e => setEditForm({...editForm, startAt: e.target.value})}
                             className="bg-bg-section border border-primary rounded px-2 py-1 text-[10px] font-black outline-none"
                           />
                        ) : (
                          <>{formatDate(room.startAt)} 오픈</>
                        )}
                      </div>
                      <div className="w-1 h-1 bg-button-outline rounded-full" />
                      <div>최종 마감: {formatDate(room.endAt)}</div>
                   </div>
                </div>

                 {/* 상세 확장 패널 */}
                 {expandedId === room.id && (
                   <div className="bg-bg-section/30 p-10 border-t border-button-outline animate-in slide-in-from-top-4 duration-300">
                      <div className="flex justify-between items-center mb-8">
                         <h4 className="text-sm font-black text-text-caption uppercase tracking-widest flex items-center">
                            <Monitor size={16} className="mr-2 text-primary" /> 실시간 배정 문항 디테일
                         </h4>
                         <button 
                           onClick={() => setPreviewRoom(room)}
                           className="flex items-center space-x-2 text-xs font-black bg-white border border-button-outline px-4 py-2 rounded-xl hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                         >
                            <Target size={14} />
                            <span>수험생 화면 전체 미리보기</span>
                         </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {room.exam.questions.map((eq, i) => (
                           <div key={i} className="bg-white p-6 rounded-[1.5rem] border border-button-outline/50 flex justify-between items-center shadow-sm">
                              <div className="flex-1">
                                 <p className="text-[10px] font-black text-primary mb-1 uppercase tracking-tighter">Q{eq.orderNum} ({eq.point}pts)</p>
                                 <p className="text-xs font-bold text-text-title line-clamp-1">{eq.question.category || '일반'}</p>
                              </div>
                              <div className="text-[10px] font-black bg-bg-section px-3 py-1 rounded-full text-text-caption uppercase">
                                 {eq.question.type}
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                 )}
             </div>
           ))}
        </div>
      </div>

      {previewRoom && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-10 bg-text-title/90 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-bg-section w-full max-w-7xl h-full rounded-[4rem] overflow-hidden flex flex-col relative border-4 border-white/20 shadow-2xl">
               <button 
                 onClick={() => setPreviewRoom(null)}
                 className="absolute top-8 right-8 z-10 p-4 bg-white/20 hover:bg-white/40 text-white rounded-full transition-all"
               >
                  <X size={32} />
               </button>
               <div className="flex-1 overflow-y-auto p-12">
                  <div className="max-w-4xl mx-auto">
                     <div className="mb-12">
                        <span className="text-[11px] font-black text-primary uppercase tracking-[0.3em] mb-4 block">Candidate Preview Mode</span>
                        <h2 className="text-5xl font-black text-text-title tracking-tighter mb-4">{previewRoom.exam.title}</h2>
                        <p className="text-lg text-text-body font-medium bg-white/50 p-6 rounded-3xl border border-button-outline whitespace-pre-wrap">{previewRoom.exam.description}</p>
                     </div>
                     <div className="space-y-12">
                        {previewRoom.exam.questions.map((eq, i) => (
                           <div key={i} className="bg-white p-12 rounded-[3.5rem] border-2 border-button-outline shadow-sm relative overflow-hidden group">
                              <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
                              <div className="flex justify-between items-start mb-10">
                                 <span className="bg-bg-section px-5 py-2 rounded-2xl text-xs font-black text-primary uppercase border border-button-outline">Question {eq.orderNum}</span>
                                 <span className="text-xs font-black text-text-caption uppercase tracking-widest">{eq.point} Points Assigned</span>
                              </div>
                              <div className="prose prose-slate max-w-none mb-10">
                                 <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {typeof eq.question.content === 'string' ? eq.question.content : (eq.question.content as any).text || ''}
                                 </ReactMarkdown>
                              </div>
                              {eq.question.type === 'MULTIPLE_CHOICE' && (
                                 <div className="space-y-4">
                                    {(eq.question.content as any).options?.map((opt: string, idx: number) => (
                                       <div key={idx} className="flex items-center p-6 bg-bg-section/50 rounded-3xl border-2 border-button-outline hover:border-primary transition-all cursor-pointer group">
                                          <div className="w-6 h-6 rounded-full border-2 border-button-outline group-hover:border-primary mr-4 flex items-center justify-center text-[10px] font-black">{idx+1}</div>
                                          <span className="text-sm font-bold text-text-body">{opt}</span>
                                       </div>
                                    ))}
                                 </div>
                              )}
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
