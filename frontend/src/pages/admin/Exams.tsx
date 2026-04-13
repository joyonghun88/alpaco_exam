import React, { useState, useEffect, useMemo } from 'react';
import { Plus, BookOpen, Trash2, CheckCircle2, ListPlus, RefreshCcw, ChevronLeft, Search, FileText, Layers, Hash, Target, ArrowRight, X, Database, ChevronUp, ChevronDown } from 'lucide-react';

interface Question {
  id: string;
  category: string;
  type: string;
  content: any;
}

interface ExamQuestion {
  questionId: string;
  orderNum: number;
  point: number;
  question: Question;
}

interface Exam {
  id: string;
  title: string;
  description: string;
  questions?: ExamQuestion[];
  _count?: { questions: number };
}

type ViewState = 'LIST' | 'DETAIL';

export default function Exams() {
  const [view, setView] = useState<ViewState>('LIST');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [questionPool, setQuestionPool] = useState<Question[]>([]);
  
  const [newExamForm, setNewExamForm] = useState({ title: '', description: '' });
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [assignmentForm, setAssignmentForm] = useState({ point: 10, orderNum: 1 });

  const authHeader = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` };

  const fetchExams = async () => {
    try {
      const res = await fetch('http://localhost:3000/admin/exams', { headers: authHeader });
      if (res.ok) setExams(await res.json());
    } catch {}
  };

  const fetchQuestionPool = async () => {
    try {
      const res = await fetch('http://localhost:3000/admin/questions/pool', { headers: authHeader });
      if (res.ok) setQuestionPool(await res.json());
    } catch {}
  };

  const fetchExamDetail = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:3000/admin/exams/${id}`, { headers: authHeader });
      if (res.ok) setSelectedExam(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchExams();
    fetchQuestionPool();
  }, []);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamForm.title) return alert('제목을 입력하세요.');
    try {
      const res = await fetch('http://localhost:3000/admin/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(newExamForm)
      });
      if (res.ok) {
        setNewExamForm({ title: '', description: '' });
        fetchExams();
      }
    } catch {}
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm('시험지를 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.')) return;
    try {
      const res = await fetch(`http://localhost:3000/admin/exams/${id}`, { 
        method: 'DELETE',
        headers: authHeader
      });
      if (res.ok) fetchExams();
    } catch {}
  };

  const handleAssignQuestion = async (q: Question) => {
    if (!selectedExam) return;
    try {
      const res = await fetch(`http://localhost:3000/admin/exams/${selectedExam.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ 
          questionId: q.id, 
          orderNum: assignmentForm.orderNum, 
          point: assignmentForm.point 
        })
      });
      if (res.ok) {
        fetchExamDetail(selectedExam.id);
        setAssignmentForm({ ...assignmentForm, orderNum: assignmentForm.orderNum + 1 });
      }
    } catch {}
  };

  const handleRemoveQuestion = async (qId: string) => {
    if (!selectedExam) return;
    if (!confirm('이 문항을 시험지에서 제외하시겠습니까?')) return;
    try {
      const res = await fetch(`http://localhost:3000/admin/exams/${selectedExam.id}/questions/${qId}`, { 
        method: 'DELETE',
        headers: authHeader
      });
      if (res.ok) fetchExamDetail(selectedExam.id);
    } catch {}
  };

  const handleMoveAction = async (qId: string, direction: 'UP' | 'DOWN') => {
    if (!selectedExam || !selectedExam.questions) return;
    const sortedQuestions = [...selectedExam.questions].sort((a,b)=>a.orderNum - b.orderNum);
    const index = sortedQuestions.findIndex(q => q.questionId === qId);
    if (index === -1) return;

    const newIndex = direction === 'UP' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sortedQuestions.length) return;

    const itemA = sortedQuestions[index];
    const itemB = sortedQuestions[newIndex];
    
    try {
      await Promise.all([
        fetch(`http://localhost:3000/admin/exams/${selectedExam.id}/questions/${itemA.questionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ orderNum: itemB.orderNum, point: itemA.point })
        }),
        fetch(`http://localhost:3000/admin/exams/${selectedExam.id}/questions/${itemB.questionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ orderNum: itemA.orderNum, point: itemB.point })
        })
      ]);
      fetchExamDetail(selectedExam.id);
    } catch {}
  };

  const categories = useMemo(() => {
    return ['ALL', ...Array.from(new Set(questionPool.map(q => q.category)))];
  }, [questionPool]);

  const filteredPool = useMemo(() => {
    return questionPool.filter(q => {
      const content = typeof q.content === 'string' ? q.content : (q.content.title || q.content.text || '');
      const matchSearch = content.toLowerCase().includes(searchTerm.toLowerCase()) || q.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = selectedCategory === 'ALL' || q.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [questionPool, searchTerm, selectedCategory]);

  const totalPages = Math.ceil(filteredPool.length / itemsPerPage);
  const paginatedPool = filteredPool.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-32">
      {/* 헤더 */}
      <div className="flex justify-between items-end border-b border-button-outline pb-8">
        <div>
           <div className="flex items-center space-x-2 text-primary font-black text-sm uppercase tracking-widest mb-2">
              <BookOpen size={16} /> <span>Exam Paper Management</span>
           </div>
           <h1 className="text-4xl font-black text-text-title tracking-tight flex items-center">
              시험지 관리
              {view === 'DETAIL' && selectedExam && (
                <span className="flex items-center text-primary-strong ml-4">
                  <ChevronLeft className="mx-2 text-atomic-gray-200" /> {selectedExam.title}
                </span>
              )}
           </h1>
        </div>
        <button onClick={fetchExams} className="p-4 bg-white border border-button-outline rounded-2xl hover:bg-bg-section transition shadow-sm">
           <RefreshCcw size={20} className="text-text-caption" />
        </button>
      </div>

      {view === 'LIST' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* 시험지 생성 폼 */}
          <div className="lg:col-span-4">
             <div className="bg-bg-default border border-button-outline rounded-[2.5rem] p-10 shadow-xl sticky top-10">
                <h2 className="text-2xl font-black text-text-title mb-8 flex items-center space-x-3">
                   <Plus className="bg-primary text-white p-1 rounded-xl" size={24} />
                   <span>신규 시험지 생성</span>
                </h2>
                <form onSubmit={handleCreateExam} className="space-y-6">
                   <div>
                      <label className="block text-[11px] font-black text-text-caption uppercase mb-3 ml-2 tracking-widest">시험지 명칭</label>
                      <input 
                        value={newExamForm.title} 
                        onChange={e=>setNewExamForm({...newExamForm, title: e.target.value})}
                        placeholder="예: 2026 상반기 신입 사원 공채"
                        className="w-full bg-bg-section border-2 border-button-outline rounded-2xl py-4 px-6 text-sm font-bold focus:border-primary outline-none transition"
                      />
                   </div>
                   <div>
                      <label className="block text-[11px] font-black text-text-caption uppercase mb-3 ml-2 tracking-widest">설명 (선택)</label>
                      <textarea 
                        value={newExamForm.description} 
                        onChange={e=>setNewExamForm({...newExamForm, description: e.target.value})}
                        placeholder="이 시험지의 목적이나 특징을 기록하세요."
                        className="w-full bg-bg-section border-2 border-button-outline rounded-2xl py-4 px-6 text-sm font-medium h-32 focus:border-primary outline-none transition"
                      />
                   </div>
                   <button type="submit" className="w-full bg-primary hover:bg-primary-strong text-white font-black py-5 rounded-3xl transition shadow-xl active:scale-[0.98] text-lg">
                      신규 시험지 마스터 등록
                   </button>
                </form>
             </div>
          </div>

          {/* 시험지 리스트 */}
          <div className="lg:col-span-8 space-y-6">
             <h2 className="text-sm font-black text-text-caption uppercase tracking-widest pl-2 mb-4">현재 보관된 시험지 목록</h2>
             <div className="grid grid-cols-1 gap-4">
                {exams.map(exam => (
                  <div 
                    key={exam.id} 
                    onClick={() => { fetchExamDetail(exam.id); setView('DETAIL'); }}
                    className="bg-bg-default border border-button-outline rounded-[2.5rem] p-8 hover:shadow-2xl hover:-translate-y-1 transition-all group flex justify-between items-center cursor-pointer relative overflow-hidden"
                  >
                     <div className="absolute top-0 left-0 w-2 h-full bg-primary/20" />
                     <div className="flex-1 pr-12">
                        <div className="flex items-center space-x-3 mb-2">
                           <span className="text-[10px] font-black px-2 py-0.5 rounded border bg-bg-section border-button-outline text-text-caption">#{exam.id.split('-')[0]}</span>
                           <span className="text-[10px] font-black text-primary">문항수: {exam._count?.questions || 0}</span>
                        </div>
                        <h4 className="text-2xl font-black text-text-title group-hover:text-primary transition-colors">{exam.title}</h4>
                        <p className="text-sm text-text-caption mt-2 font-medium truncate">{exam.description || '작성된 설명이 없습니다.'}</p>
                     </div>
                     <div className="flex space-x-2">
                        <div className="p-4 rounded-2xl group-hover:bg-primary/5 transition-all text-atomic-gray-200 group-hover:text-primary">
                           <ArrowRight size={24} />
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteExam(exam.id); }} 
                          className="p-4 text-red-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition opacity-0 group-hover:opacity-100"
                        >
                           <Trash2 size={24} />
                        </button>
                     </div>
                  </div>
                ))}
                {exams.length === 0 && (
                   <div className="py-40 text-center bg-bg-section/30 rounded-[4rem] border-4 border-dashed border-button-outline">
                      <FileText size={48} className="mx-auto mb-4 text-atomic-gray-200" />
                      <p className="text-text-caption font-black">등록된 시험지가 없습니다.<br/>왼쪽 폼에서 시험지를 먼저 생성하세요.</p>
                   </div>
                )}
             </div>
          </div>
        </div>
      )}

      {view === 'DETAIL' && selectedExam && (
        <div className="animate-in slide-in-from-right-10 duration-500">
          <button onClick={() => { setView('LIST'); fetchExams(); }} className="flex items-center space-x-2 text-sm font-black text-text-caption mb-8 px-4 py-2 hover:bg-bg-section rounded-xl transition">
             <ChevronLeft size={18} /> <span>목록으로 돌아가기</span>
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
             {/* 현재 시험지 문항 목록 */}
             <div className="lg:col-span-8 space-y-8">
                <div className="bg-bg-default border-2 border-button-outline rounded-[3rem] p-12 shadow-xl">
                   <div className="flex justify-between items-center mb-10">
                      <div>
                         <h3 className="text-3xl font-black text-text-title mb-2 tracking-tight">{selectedExam.title}</h3>
                         <p className="text-text-caption font-bold flex items-center space-x-4">
                            <span className="flex items-center"><Layers size={14} className="mr-1.5" /> 총 {selectedExam.questions?.length || 0}개 문항</span>
                            <span className="flex items-center"><Target size={14} className="mr-1.5" /> 총 배점 {selectedExam.questions?.reduce((sum, q) => sum + q.point, 0) || 0}pt</span>
                         </p>
                      </div>
                      <button 
                        onClick={() => setIsAddingQuestion(true)}
                        className="bg-primary text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-primary-strong transition shadow-xl flex items-center space-x-3 active:scale-95"
                      >
                         <ListPlus size={24} />
                         <span>문제 은행에서 불러오기</span>
                      </button>
                   </div>

                   <div className="space-y-4">
                      {selectedExam.questions?.sort((a,b)=>a.orderNum - b.orderNum).map((eq, i) => (
                        <div key={eq.questionId} className="flex items-center space-x-4 bg-bg-section/50 p-6 rounded-3xl border border-button-outline group hover:bg-white hover:shadow-lg transition-all">
                           <div className="flex flex-col space-y-1">
                              <button 
                                onClick={() => handleMoveAction(eq.questionId, 'UP')}
                                disabled={i === 0}
                                className="p-1 hover:text-primary disabled:opacity-0 transition"
                              >
                                 <ChevronUp size={16} />
                              </button>
                              <div className="w-10 h-10 bg-white border-2 border-button-outline rounded-xl flex items-center justify-center font-black text-primary shadow-sm">
                                 {i + 1}
                              </div>
                              <button 
                                onClick={() => handleMoveAction(eq.questionId, 'DOWN')}
                                disabled={i === (selectedExam.questions?.length || 0) - 1}
                                className="p-1 hover:text-primary disabled:opacity-0 transition"
                              >
                                 <ChevronDown size={16} />
                              </button>
                           </div>
                           <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                 <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-primary text-white">{eq.question.category}</span>
                                 <span className="text-[10px] font-black text-text-caption uppercase">{eq.question.type}</span>
                              </div>
                              <p className="text-lg font-bold text-text-title">{typeof eq.question.content === 'string' ? eq.question.content : (eq.question.content.title || eq.question.content.text)}</p>
                           </div>
                           <div className="bg-white border border-button-outline px-4 py-2 rounded-xl text-center">
                              <p className="text-[9px] font-black text-text-caption uppercase">배점</p>
                              <p className="text-sm font-black text-primary">{eq.point}pt</p>
                           </div>
                           <button 
                             onClick={() => handleRemoveQuestion(eq.questionId)}
                             className="p-3 text-atomic-gray-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition opacity-0 group-hover:opacity-100"
                           >
                              <Trash2 size={20} />
                           </button>
                        </div>
                      ))}
                      {(!selectedExam.questions || selectedExam.questions.length === 0) && (
                        <div className="py-32 text-center border-4 border-dashed border-button-outline rounded-[3rem] italic text-text-caption font-bold">
                           아직 배정된 문항이 없습니다.<br/>'문제 은행에서 불러오기'를 클릭하여 문항을 구성하세요.
                        </div>
                      )}
                   </div>
                </div>
             </div>

             {/* 정보 카드 - 수험생 화면 연결용 */}
             <div className="lg:col-span-4 space-y-6">
                <div className="bg-primary text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
                   <Database className="absolute -bottom-10 -right-10 w-64 h-64 opacity-10" />
                   <h4 className="text-xl font-black mb-6 flex items-center space-x-2">
                       <CheckCircle2 size={20} />
                       <span>운영 가이드</span>
                   </h4>
                   <ul className="space-y-4 text-sm font-bold text-blue-100">
                      <li className="flex items-start"><ArrowRight size={14} className="mr-2 mt-1 shrink-0" /> 문제 은행에서 등록된 문법/이론/코딩 문제들을 자유롭게 가져올 수 있습니다.</li>
                      <li className="flex items-start"><ArrowRight size={14} className="mr-2 mt-1 shrink-0" /> 각 문항별 난이도에 맞춰 개별 배점 설정이 가능합니다.</li>
                      <li className="flex items-start"><ArrowRight size={14} className="mr-2 mt-1 shrink-0" /> 설정이 완료된 시험지는'고사장 운영 관리'에서 실시간으로 개설할 수 있습니다.</li>
                   </ul>
                </div>
             </div>
          </div>

          {/* 문항 추가 오버레이 (Drawer 형태) */}
          {isAddingQuestion && (
            <div className="fixed inset-0 z-50 flex items-center justify-end animate-in fade-in duration-300">
               <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAddingQuestion(false)} />
               <div className="relative w-full max-w-2xl h-full bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.1)] flex flex-col animate-in slide-in-from-right duration-500">
                  <div className="p-10 border-b border-button-outline flex justify-between items-center">
                     <div>
                        <h3 className="text-2xl font-black text-text-title mb-1 tracking-tighter">문제 은행 컨텐츠 로드</h3>
                        <p className="text-text-caption text-xs font-bold">시험지에 추가할 문항을 선택하세요.</p>
                     </div>
                     <button onClick={() => setIsAddingQuestion(false)} className="p-3 hover:bg-bg-section rounded-2xl transition"><X size={32} /></button>
                  </div>

                  <div className="p-10 bg-bg-section/50 border-b border-button-outline space-y-6">
                     <div className="flex items-center space-x-3 overflow-x-auto pb-2 no-scrollbar">
                        {categories.map(cat => (
                           <button 
                              key={cat} 
                              onClick={() => { setSelectedCategory(cat); setCurrentPage(1); }}
                              className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border-2 ${selectedCategory === cat ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white border-button-outline text-text-caption hover:border-primary'}`}
                           >
                              {cat === 'ALL' ? '전체 카테고리' : cat}
                           </button>
                        ))}
                     </div>
                     <div className="relative">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-text-caption" size={20} />
                        <input 
                           value={searchTerm}
                           onChange={e=>{ setSearchTerm(e.target.value); setCurrentPage(1); }}
                           className="w-full bg-white border-2 border-button-outline rounded-2xl py-5 pl-16 pr-6 font-black focus:border-primary outline-none transition shadow-sm"
                           placeholder="문항 제목, 내용 검색..."
                        />
                     </div>
                     <div className="flex items-center space-x-4">
                        <div className="flex-1">
                           <label className="text-[10px] font-black text-text-caption uppercase mb-1 block ml-2">배점 설정</label>
                           <div className="relative">
                              <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={16} />
                              <input type="number" value={assignmentForm.point} onChange={e=>setAssignmentForm({...assignmentForm, point: Number(e.target.value)})} className="w-full bg-white border-2 border-button-outline rounded-xl py-3 pl-12 pr-4 font-black text-sm" />
                           </div>
                        </div>
                        <div className="flex-1">
                           <label className="text-[10px] font-black text-text-caption uppercase mb-1 block ml-2">문항 순서</label>
                           <div className="relative">
                              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={16} />
                              <input type="number" value={assignmentForm.orderNum} onChange={e=>setAssignmentForm({...assignmentForm, orderNum: Number(e.target.value)})} className="w-full bg-white border-2 border-button-outline rounded-xl py-3 pl-12 pr-4 font-black text-sm" />
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-10 space-y-4">
                     {paginatedPool.map(q => {
                       const isAlreadyAdded = selectedExam.questions?.some(eq => eq.questionId === q.id);
                       return (
                         <div key={q.id} className={`p-6 rounded-[2rem] border-2 transition-all flex justify-between items-center ${isAlreadyAdded ? 'bg-bg-section border-transparent opacity-50' : 'bg-white border-button-outline hover:border-primary hover:shadow-xl'}`}>
                            <div className="flex-1">
                               <div className="flex items-center space-x-2 mb-1">
                                  <span className="text-[9px] font-black bg-bg-section px-1.5 py-0.5 rounded border border-button-outline">{q.category}</span>
                                  <span className="text-[9px] font-black text-text-caption uppercase">{q.type}</span>
                               </div>
                               <h5 className="font-bold text-text-title leading-snug">{typeof q.content === 'string' ? q.content : (q.content.title || q.content.text)}</h5>
                            </div>
                            {isAlreadyAdded ? (
                               <span className="text-[10px] font-black text-emerald-500 whitespace-nowrap ml-4">담김</span>
                            ) : (
                               <button 
                                 onClick={() => handleAssignQuestion(q)}
                                 className="ml-4 bg-primary text-white p-3 rounded-xl hover:bg-primary-strong transition shadow-md active:scale-90"
                               >
                                  <Plus size={20} />
                                </button>
                            )}
                         </div>
                       );
                     })}
                     {paginatedPool.length === 0 && (
                        <div className="text-center py-20 text-text-caption font-bold italic">검색 결과가 없습니다.</div>
                     )}
                  </div>

                  {/* 페이지네이션 컨트롤 */}
                  {totalPages > 1 && (
                     <div className="p-8 border-t border-button-outline bg-bg-section/30 flex justify-between items-center">
                        <button 
                           disabled={currentPage === 1}
                           onClick={() => setCurrentPage(prev => prev - 1)}
                           className="px-6 py-3 bg-white border-2 border-button-outline rounded-xl text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition"
                        >
                           이전
                        </button>
                        <div className="text-[11px] font-black text-text-caption">
                           PAGE <span className="text-primary">{currentPage}</span> / {totalPages}
                        </div>
                        <button 
                           disabled={currentPage === totalPages}
                           onClick={() => setCurrentPage(prev => prev + 1)}
                           className="px-6 py-3 bg-white border-2 border-button-outline rounded-xl text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition"
                        >
                           다음
                        </button>
                     </div>
                  )}
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
