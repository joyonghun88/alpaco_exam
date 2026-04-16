import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Check,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Link2,
  Plus,
  RefreshCcw,
  Send,
  Trash2,
  UploadCloud,
  Users,
  X
} from 'lucide-react';
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

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const [showBulk, setShowBulk] = useState(false);
  const [targetRoomId, setTargetRoomId] = useState('');
  const [bulkText, setBulkText] = useState('');
  const participantFileInputRef = useRef<HTMLInputElement>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [inviteTargetIds, setInviteTargetIds] = useState<string[] | null>(null);
  const [emailTemplate, setEmailTemplate] = useState(
    `안녕하세요 {{name}}님
아래 [{{room}}] 방에 배정되었습니다.

- 초대 코드: {{code}}
- 접속 링크: {{link}}

감사합니다.`
  );

  const authHeader = useMemo(
    () => ({ Authorization: `Bearer ${localStorage.getItem('adminToken')}` }),
    []
  );

  const fetchData = async () => {
    try {
      const [resRooms, resParticipants] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/rooms`, { headers: authHeader }),
        fetch(`${API_BASE_URL}/admin/participants`, { headers: authHeader })
      ]);

      if (resRooms.ok) setRooms(await resRooms.json());
      if (resParticipants.ok) setParticipants(await resParticipants.json());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRoom = useMemo(
    () => rooms.find(r => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  const filteredParticipants = useMemo(() => {
    if (!selectedRoomId) return [];
    return participants.filter(p => p.roomId === selectedRoomId);
  }, [participants, selectedRoomId]);

  const handleAdd = async (e: any) => {
    e.preventDefault?.();
    if (!selectedRoomId) return alert('먼저 평가방을 선택해 주세요.');
    if (!name.trim() || !email.trim())
      return alert('이름과 이메일(아이디)을 모두 입력해 주세요.');

    try {
      const res = await fetch(`${API_BASE_URL}/admin/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), roomId: selectedRoomId })
      });
      if (res.ok) {
        setName('');
        setEmail('');
        fetchData();
      } else {
        const err = await res.json().catch(() => ({} as any));
        alert(`등록 실패: ${err.message || res.status}`);
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
      else alert(`삭제 실패: ${res.status}`);
    } catch {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      '이름,이메일\n' +
      '홍길동,hong@example.com\n' +
      '김철수,kim@alpaco.io\n' +
      '박영희,park@dx.com';

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'participant_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      setBulkText(String(event.target?.result || ''));
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleBulkAdd = async () => {
    if (!targetRoomId) return alert('평가방을 선택해 주세요.');
    if (!bulkText.trim()) return alert('CSV 텍스트를 입력해 주세요.');

    const lines = bulkText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .filter(l => l.includes(','))
      .filter(l => !l.startsWith('이름,'));

    const parsed = lines
      .map(l => {
        const [rawName, rawEmail] = l.split(',');
        return {
          name: (rawName || '').trim(),
          email: (rawEmail || '').trim()
        };
      })
      .filter(p => p.name && p.email && p.email.includes('@'));

    if (parsed.length === 0)
      return alert('유효한 데이터가 없습니다. [이름, 이메일] 형식으로 입력해 주세요.');

    try {
      const res = await fetch(`${API_BASE_URL}/admin/participants/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ roomId: targetRoomId, participants: parsed })
      });

      if (res.ok) {
        alert(`${parsed.length}명 등록되었습니다.`);
        setBulkText('');
        setShowBulk(false);
        fetchData();
      } else {
        const err = await res.json().catch(() => ({} as any));
        alert(`등록 실패: ${err.message || res.status}`);
      }
    } catch {
      alert('등록 중 오류가 발생했습니다.');
    }
  };

  const copyLink = async (code: string, id: string) => {
    const url = `${window.location.origin}/exam?code=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  const openInviteModal = (ids: string[] | null) => {
    setInviteTargetIds(ids);
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

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        alert(`발송 실패: ${data.message || res.status}`);
        return;
      }

      const failedCount = Number(data.failedCount ?? 0);
      const successCount = Number(data.successCount ?? 0);
      if (failedCount > 0) {
        const first = Array.isArray(data.results) ? data.results.find((r: any) => r.status === 'FAILED') : null;
        alert(`발송 완료(부분 실패)\n성공: ${successCount} / 실패: ${failedCount}\n${first?.error ? `첫 오류: ${first.error}` : ''}`.trim());
      } else {
        alert(inviteTargetIds ? '발송이 완료되었습니다.' : '일괄 발송이 완료되었습니다.');
      }

      setShowBulkInvite(false);
      setInviteTargetIds(null);
    } catch {
      alert('발송 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-button-outline pb-8">
        <div className="animate-in fade-in duration-700">
          <div className="flex items-center space-x-2 text-primary font-black text-sm uppercase tracking-widest mb-2">
            <Building2 size={16} /> <span>수험생 배정 관리</span>
          </div>
          <h1 className="text-4xl font-black text-text-title tracking-tight flex items-center">
            수험생 배정 관리
            {selectedRoomId && (
              <span className="flex items-center text-primary-strong ml-4">
                <ChevronRight className="mx-2 text-atomic-gray-200" /> {selectedRoom?.roomName}
              </span>
            )}
          </h1>
          <p className="text-text-caption mt-2 font-medium">
            평가방을 선택한 뒤 수험생을 등록하고 초대코드를 발송할 수 있습니다.
          </p>
        </div>

        <div className="flex space-x-3">
          {selectedRoomId && (
            <div className="flex space-x-2">
              <button
                onClick={() => openInviteModal(null)}
                className="px-6 py-4 bg-primary/10 text-primary border border-primary/20 rounded-2xl font-black flex items-center space-x-2 hover:bg-primary hover:text-white transition-all shadow-sm"
              >
                <Send size={20} />
                <span>초대코드 발송</span>
              </button>
              <button
                onClick={() => {
                  setTargetRoomId(selectedRoomId);
                  setShowBulk(true);
                }}
                className="px-6 py-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-2xl font-black flex items-center space-x-2 hover:bg-emerald-100 transition-all shadow-sm"
              >
                <FileSpreadsheet size={20} />
                <span>일괄 등록</span>
              </button>
            </div>
          )}

          <button
            onClick={fetchData}
            className="p-4 bg-white border border-button-outline rounded-2xl hover:bg-bg-section transition shadow-sm"
            title="새로고침"
          >
            <RefreshCcw size={20} className="text-text-caption" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <div className="xl:col-span-4">
          <div className="space-y-4">
            <h2 className="text-sm font-black text-text-caption uppercase tracking-widest pl-2 mb-4">
              평가방 목록
            </h2>

            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => setSelectedRoomId(room.id)}
                className={`w-full text-left p-6 rounded-[2rem] border-2 transition-all group relative overflow-hidden active:scale-95 ${
                  selectedRoomId === room.id
                    ? 'bg-primary border-primary shadow-xl scale-[1.02]'
                    : 'bg-bg-default border-button-outline hover:border-primary/50'
                }`}
              >
                <div className="relative z-10">
                  <h3
                    className={`text-xl font-black leading-tight ${
                      selectedRoomId === room.id ? 'text-white' : 'text-text-title'
                    }`}
                  >
                    {room.roomName}
                  </h3>
                  <p
                    className={`text-xs mt-1 font-bold ${
                      selectedRoomId === room.id ? 'text-white/70' : 'text-text-caption'
                    }`}
                  >
                    {room.exam.title}
                  </p>
                  <div className="mt-8 flex items-center justify-between">
                    <div
                      className={`flex items-center space-x-2 text-sm font-black ${
                        selectedRoomId === room.id ? 'text-white' : 'text-primary'
                      }`}
                    >
                      <Users size={16} />
                      <span>{room._count.participants}명</span>
                    </div>
                    {selectedRoomId === room.id && <Check className="text-white animate-in zoom-in" />}
                  </div>
                </div>
              </button>
            ))}

            {rooms.length === 0 && (
              <div className="p-10 text-center bg-bg-section rounded-[2rem] border-2 border-dashed border-button-outline text-text-caption font-bold">
                등록된 평가방이 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-8 space-y-8">
          {!selectedRoomId ? (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-bg-section/30 rounded-[3rem] border-2 border-dashed border-button-outline animate-in fade-in duration-500">
              <Building2 size={64} className="text-atomic-gray-200 mb-6" />
              <h3 className="text-xl font-black text-text-caption">왼쪽에서 평가방을 선택해 주세요.</h3>
              <p className="text-text-caption font-medium mt-2">
                평가방을 선택하면 수험생 등록/초대코드 발송 등 관리 기능을 사용할 수 있습니다.
              </p>
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-right-10 duration-500">
              <div className="bg-bg-default border border-button-outline rounded-[2.5rem] p-10 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[4rem] flex items-center justify-center">
                  <Plus className="text-primary/30" size={40} />
                </div>

                <h2 className="text-2xl font-black text-text-title mb-8 flex items-center space-x-2">
                  <span>{selectedRoom?.roomName} 수험생 등록</span>
                </h2>

                <form onSubmit={handleAdd} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="수험생 이름"
                      className="w-full bg-bg-section border-2 border-button-outline p-5 rounded-2xl text-lg font-bold outline-none focus:border-primary transition"
                    />
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="이메일(아이디)"
                      className="w-full bg-bg-section border-2 border-button-outline p-5 rounded-2xl text-lg font-bold outline-none focus:border-primary transition"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary-strong text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95 text-lg"
                  >
                    수험생 추가
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetRoomId(selectedRoomId);
                        setShowBulk(true);
                      }}
                      className="text-xs font-black text-text-caption hover:text-primary transition-colors flex items-center justify-center space-x-1 mx-auto"
                    >
                      <FileSpreadsheet size={14} />
                      <span>CSV로 일괄 등록</span>
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-bg-default border border-button-outline rounded-[2.5rem] p-10 shadow-lg">
                <div className="flex items-end justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-black text-text-title">발급된 수험표(초대코드) 목록</h2>
                    <p className="text-text-caption font-medium mt-2">
                      총 {filteredParticipants.length}명
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredParticipants.map(person => (
                    <div
                      key={person.id}
                      className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-bg-section/40 border border-button-outline rounded-2xl p-5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="font-black text-text-title truncate">{person.name}</div>
                          <div className="text-xs font-black text-text-caption truncate">{person.email}</div>
                        </div>
                        <div className="mt-1 text-xs font-mono text-text-caption break-all">
                          코드: {person.invitationCode}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => copyLink(person.invitationCode, person.id)}
                          className={`px-4 py-3 rounded-2xl transition-all flex items-center space-x-2 font-black text-xs active:scale-95 ${
                            copiedId === person.id
                              ? 'bg-emerald-500 text-white shadow-emerald-200 shadow-xl'
                              : 'bg-bg-default border border-button-outline text-text-caption hover:border-primary/50'
                          }`}
                          title="링크 복사"
                        >
                          <Link2 size={16} />
                          <span>{copiedId === person.id ? '복사됨' : '링크 복사'}</span>
                        </button>

                        <button
                          onClick={() => openInviteModal([person.id])}
                          className="px-4 py-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all font-black text-xs active:scale-95 flex items-center space-x-2"
                          title="초대코드 발송"
                        >
                          <Send size={16} />
                          <span>발송</span>
                        </button>

                        <button
                          onClick={() => handleDelete(person.id)}
                          className="px-4 py-3 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all font-black text-xs active:scale-95 flex items-center space-x-2"
                          title="삭제"
                        >
                          <Trash2 size={16} />
                          <span>삭제</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {filteredParticipants.length === 0 && (
                    <div className="p-10 text-center bg-bg-section rounded-3xl border-2 border-dashed border-button-outline text-text-caption font-bold">
                      아직 등록된 수험생이 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showBulk && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 pb-20 overflow-auto">
          <div className="bg-bg-default w-full max-w-4xl border-2 border-primary/20 rounded-[4rem] p-12 shadow-[0_0_100px_rgba(0,0,0,0.2)] animate-in zoom-in-95 relative">
            <button
              onClick={() => setShowBulk(false)}
              className="absolute top-10 right-10 p-4 hover:bg-bg-section rounded-3xl transition"
            >
              <X size={32} />
            </button>

            <h2 className="text-4xl font-black mb-4 tracking-tighter">수험생 일괄 등록</h2>
            <p className="text-text-caption mb-10 font-bold">
              평가방을 선택하고 CSV 텍스트를 입력하거나 파일을 업로드해 수험생을 일괄 등록하세요.
            </p>

            <div className="space-y-8">
              {!selectedRoomId ? (
                <div>
                  <label className="text-[11px] font-black text-text-caption uppercase tracking-widest pl-2 mb-4 block">
                    1. 평가방 선택
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {rooms.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setTargetRoomId(r.id)}
                        className={`p-4 rounded-2xl border-2 font-black text-xs transition-all ${
                          targetRoomId === r.id
                            ? 'bg-primary border-primary text-white'
                            : 'bg-bg-section border-button-outline text-text-caption hover:border-primary/50'
                        }`}
                      >
                        {r.roomName}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10">
                  <p className="text-sm font-black text-primary flex items-center">
                    <Check size={18} className="mr-2" />
                    {selectedRoom?.roomName} (현재 선택된 평가방)
                  </p>
                </div>
              )}

              <div>
                <div className="flex justify-between items-end mb-4">
                  <label className="text-[11px] font-black text-text-caption uppercase tracking-widest pl-2 block">
                    {selectedRoomId ? '1. 수험생 목록 입력 (CSV)' : '2. 수험생 목록 입력 (CSV)'}
                  </label>
                  <button
                    onClick={() => participantFileInputRef.current?.click()}
                    className="flex items-center space-x-2 text-xs font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl hover:bg-emerald-100 transition shadow-sm"
                  >
                    <UploadCloud size={14} /> <span>CSV 파일 업로드</span>
                  </button>
                  <input
                    type="file"
                    ref={participantFileInputRef}
                    onChange={handleFileUpload}
                    accept=".csv,.txt"
                    className="hidden"
                  />
                </div>

                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  className="w-full h-64 bg-bg-section border-2 border-button-outline rounded-[2.5rem] p-8 font-mono text-sm focus:border-primary outline-none shadow-inner"
                  placeholder="이름, 이메일(예: 홍길동, hong@example.com)"
                />

                <button
                  onClick={handleDownloadTemplate}
                  className="mt-4 flex items-center space-x-2 text-xs font-black text-primary hover:underline"
                >
                  <Download size={14} /> <span>CSV 템플릿 다운로드</span>
                </button>
              </div>

              <button
                onClick={handleBulkAdd}
                className="w-full bg-emerald-600 text-white py-6 rounded-3xl font-black text-xl shadow-2xl hover:bg-emerald-700 transition active:scale-95"
              >
                수험생 일괄 등록
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkInvite && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 pb-20 overflow-auto">
          <div className="bg-bg-default w-full max-w-3xl border-2 border-primary/20 rounded-[4rem] p-12 shadow-2xl animate-in zoom-in-95 relative">
            <button
              onClick={() => setShowBulkInvite(false)}
              className="absolute top-10 right-10 p-4 hover:bg-bg-section rounded-3xl transition"
            >
              <X size={32} />
            </button>

            <h2 className="text-4xl font-black mb-4 tracking-tighter">초대코드 발송</h2>
            <p className="text-text-caption mb-10 font-bold">
              선택된 평가방의 수험생 {filteredParticipants.length}명에게 이메일로 초대코드를 발송합니다.
            </p>

            <div className="space-y-6">
              <div>
                <label className="text-[11px] font-black text-text-caption uppercase tracking-widest pl-2 mb-2 block">
                  이메일 템플릿
                </label>
                <textarea
                  value={emailTemplate}
                  onChange={e => setEmailTemplate(e.target.value)}
                  className="w-full h-80 bg-bg-section border-2 border-button-outline rounded-[2.5rem] p-8 font-medium text-lg focus:border-primary outline-none shadow-inner leading-relaxed"
                  placeholder="이메일 내용을 입력해 주세요."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-primary/5 rounded-2xl text-[11px] font-bold text-primary">
                  사용 가능한 변수:<br />
                  {`{{name}}`}: 수험생 이름
                  <br />
                  {`{{room}}`}: 평가방 이름
                </div>
                <div className="p-4 bg-primary/5 rounded-2xl text-[11px] font-bold text-primary">
                  사용 가능한 변수:<br />
                  {`{{code}}`}: 초대코드
                  <br />
                  {`{{link}}`}: 접속 URL
                </div>
              </div>

              <button
                onClick={handleBulkInvite}
                className="w-full bg-primary text-white py-6 rounded-3xl font-black text-xl shadow-2xl hover:bg-primary-strong transition active:scale-95 flex items-center justify-center space-x-2"
              >
                <Send size={22} />
                <span>{filteredParticipants.length}명에게 초대코드 발송</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
