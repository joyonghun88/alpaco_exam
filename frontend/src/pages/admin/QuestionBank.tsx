import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, Database, BookOpen, RefreshCcw, ChevronLeft, ChevronRight, LayoutGrid, Layers, Edit3, Save, CheckCircle2, Type, ListChecks, HelpCircle, AlignLeft, PlusCircle, MinusCircle, ArrowLeft, Target } from 'lucide-react';
import '@toast-ui/editor/dist/toastui-editor.css';
import { Editor } from '@toast-ui/react-editor';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Question {
  id: string; category: string; type: string; content: any; correctAnswer: any; createdAt: string; parentId?: string; parent?: Question;
}

const DEFAULT_CATEGORIES = ['CS 기초', 'Frontend', 'Backend', 'DevOps', 'AI/Data', '기타 실무'];
const QUESTION_TYPES = [
  { value: 'MULTIPLE_CHOICE', label: '객관식', icon: <ListChecks size={18} /> },
  { value: 'SHORT_ANSWER', label: '단답형 주관식', icon: <Type size={18} /> },
  { value: 'FILL_IN_THE_BLANK', label: '빈칸 채우기', icon: <HelpCircle size={18} /> },
  { value: 'ESSAY', label: '서술형(에세이)', icon: <AlignLeft size={18} /> }
];

type ViewState = 'CATEGORIES' | 'LIST' | 'EDITOR';

export default function QuestionBank() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [view, setView] = useState<ViewState>('CATEGORIES');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [addedCategories, setAddedCategories] = useState<string[]>([]);
  
  const [editorForm, setEditorForm] = useState({
    id: null as string | null,
    category: DEFAULT_CATEGORIES[0], 
    type: 'MULTIPLE_CHOICE', 
    title: '',
    passage: '',
    options: ['옵션 1', '옵션 2', '옵션 3', '옵션 4'], 
    correctAnswer: [] as string[],
    imageUrl: '',
    isMdEnabled: true,
    parentId: null as string | null
  });
  const editorRef = useRef<any>(null);

  const authHeader = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` };

  const fetchQuestions = async () => {
    try {
      const res = await fetch('http://localhost:3000/admin/questions/pool', { headers: authHeader });
      if (res.ok) setQuestions(await res.json());
    } catch {}
  };

  useEffect(() => { fetchQuestions(); }, []);

  const categories = useMemo(() => {
    const existing = Array.from(new Set(questions.map(q => q.category)));
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...existing, ...addedCategories]));
  }, [questions, addedCategories]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach(cat => counts[cat] = 0);
    questions.forEach(q => { if (counts[q.category] !== undefined) counts[q.category]++; });
    return counts;
  }, [questions, categories]);

  const filteredQuestions = useMemo(() => {
    if (!selectedCategory) return [];
    return questions.filter(q => {
      const matchCat = q.category === selectedCategory;
      const matchType = selectedType === 'ALL' || q.type === selectedType;
      return matchCat && matchType;
    });
  }, [questions, selectedCategory, selectedType]);

  const handleSaveQuestion = async () => {
    let finalContent: any = { 
      title: editorForm.title,
      passage: editorForm.passage,
      imageUrl: editorForm.imageUrl,
    };
    
    let finalCorrectAnswer: any = editorForm.correctAnswer;
    if (editorForm.type === 'MULTIPLE_CHOICE') {
      finalContent.options = editorForm.options;
    } else if (editorForm.type === 'FILL_IN_THE_BLANK') {
      finalCorrectAnswer = editorForm.options; 
    } else if (editorForm.type === 'SHORT_ANSWER') {
      finalCorrectAnswer = editorForm.correctAnswer[0] || '';
    }

    try {
      const url = editorForm.id 
        ? `http://localhost:3000/admin/questions/pool/${editorForm.id}`
        : 'http://localhost:3000/admin/questions/pool';
      const method = editorForm.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ category: editorForm.category, type: editorForm.type, content: finalContent, correctAnswer: finalCorrectAnswer, parentId: editorForm.parentId })
      });
      if (res.ok) { 
        alert(editorForm.id ? '문항이 수정되었습니다.' : '문항이 성공적으로 저장되었습니다.'); 
        resetEditor();
        setView('LIST'); 
        fetchQuestions(); 
      }
    } catch {}
  };

  const handleEditorChange = () => {
    if (editorRef.current) {
      const md = editorRef.current.getInstance().getMarkdown();
      setEditorForm(prev => ({ ...prev, passage: md }));
    }
  };

  const resetEditor = () => {
    setEditorForm({ 
      id: null, passage: '', title: '', imageUrl: '', isMdEnabled: true,
      options: ['옵션 1', '옵션 2', '옵션 3', '옵션 4'], 
      category: selectedCategory || DEFAULT_CATEGORIES[0], 
      type: 'MULTIPLE_CHOICE', 
      correctAnswer: [],
      parentId: null
    });
  };

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('http://localhost:3000/admin/questions/upload', {
        method: 'POST',
        headers: authHeader,
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        const url = data.url.startsWith('http') ? data.url : `http://localhost:3000${data.url}`;
        return url;
      }
    } catch {
      alert('이미지 업로드 실패');
    }
    return null;
  };

  const handleEdit = (q: Question) => {
    setEditorForm({
      id: q.id,
      category: q.category,
      type: q.type,
      passage: q.content.passage || '',
      title: q.content.title || '',
      options: q.content.options || (q.type === 'FILL_IN_THE_BLANK' ? q.correctAnswer : ['옵션 1']),
      correctAnswer: Array.isArray(q.correctAnswer) ? q.correctAnswer.map(v => String(v)) : [String(q.correctAnswer)],
      imageUrl: q.content.imageUrl || '',
      isMdEnabled: true,
      parentId: q.parentId || null
    });
    setView('EDITOR');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`http://localhost:3000/admin/questions/pool/${id}`, { 
        method: 'DELETE',
        headers: authHeader
      });
      if (res.ok) fetchQuestions();
    } catch {}
  };

  const addOption = () => {
    setEditorForm({ ...editorForm, options: [...editorForm.options, `옵션 ${editorForm.options.length + 1}`] });
  };

  const removeOption = (idx: number) => {
    if (editorForm.options.length <= 1) return;
    const newOptions = editorForm.options.filter((_, i) => i !== idx);
    const newCorrect = editorForm.correctAnswer.filter(c => c !== String(idx)).map(c => Number(c) > idx ? String(Number(c) - 1) : c);
    setEditorForm({ ...editorForm, options: newOptions, correctAnswer: newCorrect });
  };

  const updateOption = (idx: number, val: string) => {
    const newOptions = [...editorForm.options];
    newOptions[idx] = val;
    setEditorForm({ ...editorForm, options: newOptions });
  };

  const renderCorrectAnswer = (q: any) => {
    const ans = q.correctAnswer;
    if (!ans && ans !== 0 && (!Array.isArray(ans) || ans.length === 0)) return '미지정';
    if (q.type === 'MULTIPLE_CHOICE') {
      if (Array.isArray(ans)) return ans.map(i => Number(i) + 1).join(', ') + '번';
      return `${Number(ans) + 1}번`;
    }
    if (Array.isArray(ans)) return ans.join(', ');
    return String(ans);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-button-outline pb-8">
        <div>
          <div className="flex items-center space-x-2 text-primary font-black text-sm uppercase tracking-widest mb-2">
             <Layers size={16} /> <span>Hybrid Question Pool v2</span>
          </div>
          <h1 className="text-4xl font-black text-text-title tracking-tight flex items-center">
             공통 문제 은행
             {selectedCategory && (
                <span className="flex items-center text-primary-strong ml-4">
                  <ChevronRight className="mx-2 text-atomic-gray-200" /> {selectedCategory}
                </span>
             )}
          </h1>
        </div>
        <div className="flex space-x-3">
           {selectedCategory && (
             <button onClick={() => { resetEditor(); setView('EDITOR'); }} className="px-6 py-4 bg-primary text-white rounded-2xl font-black flex items-center space-x-2 hover:bg-primary-strong transition-all shadow-xl active:scale-95">
                <PlusCircle size={20} />
                <span>신규 문항 추가</span>
             </button>
           )}
           <button onClick={() => { setView('CATEGORIES'); setSelectedCategory(null); fetchQuestions(); }} className="p-4 bg-white border border-button-outline rounded-2xl hover:bg-bg-section transition shadow-sm">
              <RefreshCcw size={20} className="text-text-caption" />
           </button>
        </div>
      </div>

      <div className="min-h-[60vh]">
        {view === 'CATEGORIES' && (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
             {categories.map(cat => (
               <div key={cat} className="group relative">
                 <button onClick={() => { setSelectedCategory(cat); setView('LIST'); }} className="w-full bg-bg-default border border-button-outline rounded-[3rem] p-12 text-left hover:shadow-2xl hover:-translate-y-3 transition-all relative overflow-hidden h-full">
                   <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full" />
                   <LayoutGrid className="text-primary mb-8" size={48} />
                   <h3 className="text-3xl font-black text-text-title mb-4">{cat}</h3>
                   <p className="text-text-caption font-bold flex items-center space-x-2"><Database size={16} /> <span>{stats[cat] || 0} 문항</span></p>
                 </button>
               </div>
             ))}
             <button onClick={() => { const n = prompt('새 카테고리:'); if(n) setAddedCategories([...addedCategories, n]); }} className="border-2 border-dashed border-button-outline rounded-[3rem] p-12 text-center hover:border-primary transition-all flex flex-col items-center justify-center space-y-4 hover:bg-white text-text-caption hover:text-primary min-h-[300px]">
                <Plus size={48} />
                <span className="text-xl font-black">카테고리 추가</span>
             </button>
           </div>
        )}

        {view === 'LIST' && (
           <div className="space-y-6">
              <div className="flex justify-between items-center">
                 <button onClick={() => setView('CATEGORIES')} className="flex items-center space-x-2 text-sm font-black text-text-caption px-4 py-2 hover:bg-bg-section rounded-xl transition"><ChevronLeft size={18} /> <span>목록으로</span></button>
                 <div className="flex items-center bg-bg-section p-1.5 rounded-2xl border border-button-outline">
                    <button onClick={() => setSelectedType('ALL')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${selectedType === 'ALL' ? 'bg-primary text-white' : 'text-text-caption hover:text-text-title'}`}>전체</button>
                    {QUESTION_TYPES.map(t => (
                      <button key={t.value} onClick={() => setSelectedType(t.value)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 ${selectedType === t.value ? 'bg-primary text-white' : 'text-text-caption hover:text-text-title'}`}>{t.icon}<span>{t.label}</span></button>
                    ))}
                 </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                 {filteredQuestions.map(q => (
                   <div key={q.id} className="bg-bg-default border border-button-outline rounded-[2.5rem] p-8 hover:shadow-xl transition-all group flex justify-between items-center relative overflow-hidden">
                      <div className="flex-1 pr-12">
                         <div className="flex items-center space-x-2 mb-2">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded border bg-bg-section border-button-outline text-text-caption">{QUESTION_TYPES.find(t=>t.value === q.type)?.label}</span>
                         </div>
                         <h4 className="text-xl font-bold text-text-title leading-relaxed">
                            {(() => {
                               const passage = q.content?.passage || q.parent?.content?.passage;
                               if (passage) return (passage.replace(/[#*`~\[\]()]/g, '').substring(0, 100) + (passage.length > 100 ? '...' : ''));
                               return (q.content?.title || q.content?.text || '내용 없음');
                            })()}
                         </h4>
                         <div className="mt-2 flex items-center space-x-4">
                            <p className="text-emerald-600 font-bold text-sm flex items-center space-x-1">
                               <CheckCircle2 size={14} />
                               <span>정답: {renderCorrectAnswer(q)}</span>
                            </p>
                            {q.parentId && (
                               <p className="text-primary font-bold text-sm flex items-center space-x-1">
                                  <BookOpen size={14} />
                                  <span>연계 지문 사용 중</span>
                               </p>
                            )}
                         </div>
                      </div>
                      <div className="flex space-x-2">
                         <button onClick={() => handleEdit(q)} className="p-3 text-primary hover:bg-primary/10 rounded-xl transition"><Edit3 size={20} /></button>
                         <button onClick={() => handleDelete(q.id)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition"><Trash2 size={20} /></button>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        )}

        {view === 'EDITOR' && (
           <div className="fixed inset-0 z-50 bg-bg-section overflow-y-auto">
              <div className="max-w-6xl mx-auto py-20 px-4">
                 {/* Sticky Header */}
                 <div className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-button-outline z-50 px-8 py-4 flex justify-between items-center shadow-sm">
                    <div className="flex items-center space-x-4">
                       <button onClick={()=>setView('LIST')} className="p-3 hover:bg-bg-section rounded-2xl transition"><ArrowLeft size={24}/></button>
                       <h2 className="text-xl font-black text-text-title">{editorForm.id ? '문항 상세 수정' : '신규 문항 등록'}</h2>
                    </div>
                    <div className="flex items-center space-x-3">
                       <button onClick={()=>setView('LIST')} className="px-6 py-3 bg-white border border-button-outline rounded-xl font-bold text-sm transition">취소</button>
                       <button onClick={handleSaveQuestion} className="px-8 py-3 bg-primary text-white rounded-xl font-black text-sm hover:bg-primary-strong transition shadow-lg shadow-primary/20 flex items-center space-x-2">
                          <Save size={18} />
                          <span>저장 완료</span>
                       </button>
                    </div>
                 </div>

                 <div className="pt-10 space-y-10">
                    <div className="grid grid-cols-2 gap-8 mb-6">
                       <div><label className="text-xs font-black text-text-caption uppercase mb-3 block">카테고리</label><div className="bg-bg-section border-2 border-button-outline rounded-2xl py-4 px-6 font-black text-primary">{editorForm.category}</div></div>
                       <div><label className="text-xs font-black text-text-caption uppercase mb-3 block">유형</label><select value={editorForm.type} onChange={e=>setEditorForm({...editorForm, type: e.target.value, correctAnswer: [], options: ['옵션 1']})} className="w-full bg-white border-2 border-button-outline rounded-2xl py-4 px-6 font-black outline-none focus:border-primary transition">{QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                    </div>

                    {/* 연계 지문 설정 */}
                    <div className="bg-white p-8 rounded-[2.5rem] border-2 border-button-outline shadow-sm">
                       <div className="flex justify-between items-center mb-6">
                          <label className="text-xs font-black text-primary uppercase flex items-center space-x-2">
                             <BookOpen size={16} /> <span>지문 설정 (Passage Source)</span>
                          </label>
                          <div className="flex bg-bg-section p-1 rounded-xl border border-button-outline">
                             <button onClick={()=>setEditorForm({...editorForm, parentId: null})} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${!editorForm.parentId ? 'bg-primary text-white shadow-md' : 'text-text-caption hover:text-text-title'}`}>직접 입력</button>
                             <button onClick={()=>{
                               const other = questions.find(q => q.category === editorForm.category && q.id !== editorForm.id && q.content.passage);
                               if(other) setEditorForm({...editorForm, parentId: other.id});
                               else alert('현재 카테고리에 지문이 있는 다른 문항이 없습니다.');
                             }} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${editorForm.parentId ? 'bg-primary text-white shadow-md' : 'text-text-caption hover:text-text-title'}`}>기존 지문 연결</button>
                          </div>
                       </div>
                       
                       {editorForm.parentId && (
                          <div className="space-y-4">
                             <label className="text-[10px] font-black text-text-caption uppercase tracking-tighter">연계할 문항 선택</label>
                             <select 
                               value={editorForm.parentId} 
                               onChange={e=>setEditorForm({...editorForm, parentId: e.target.value})}
                               className="w-full bg-white border-2 border-primary/50 rounded-2xl py-4 px-6 font-bold outline-none shadow-sm focus:border-primary transition-all"
                             >
                                {questions.filter(q => q.category === editorForm.category && q.id !== editorForm.id && q.content.passage).map(q => (
                                   <option key={q.id} value={q.id}>[{q.type}] {q.content.title.substring(0, 40)}...</option>
                                ))}
                             </select>
                             <div className="p-6 bg-primary/5 rounded-2xl border border-primary/20">
                                <p className="text-xs font-black text-primary uppercase mb-2">연계 지문 미리보기</p>
                                <p className="text-sm text-text-title font-medium leading-relaxed italic line-clamp-3">
                                   {questions.find(q => q.id === editorForm.parentId)?.content.passage}
                                </p>
                             </div>
                          </div>
                       )}
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border-2 border-button-outline shadow-sm">
                       <label className="text-xs font-black text-primary uppercase mb-4 block">1. 질문 (Question)</label>
                       <textarea value={editorForm.title} onChange={e=>setEditorForm({...editorForm, title: e.target.value})} className="w-full bg-transparent border-none outline-none text-2xl font-black placeholder-atomic-gray-200 min-h-[100px]" placeholder="질문 내용을 입력하세요" />
                    </div>

                    {!editorForm.parentId && (
                       <div className="bg-white p-2 rounded-[3.5rem] border-2 border-button-outline overflow-hidden shadow-inner">
                          <div className="bg-bg-section/30 p-8 border-b border-button-outline">
                             <label className="text-xs font-black text-text-caption uppercase pl-2">2. 지문 및 자료 (Professional Markdown Editor)</label>
                          </div>
                          <div className="p-2">
                             <Editor
                                ref={editorRef}
                                initialValue={editorForm.passage}
                                previewStyle="vertical"
                                height="500px"
                                initialEditType="markdown"
                                language="ko-KR"
                                onChange={handleEditorChange}
                                hooks={{
                                   addImageBlobHook: async (blob: Blob | File, callback: (url: string, alt?: string) => void) => {
                                      const url = await uploadImage(blob as File);
                                      if (url) callback(url, 'image');
                                      return false;
                                   }
                                }}
                                toolbarItems={[['heading', 'bold', 'italic', 'strike'], ['hr', 'quote'], ['ul', 'ol', 'task', 'indent', 'outdent'], ['table', 'image', 'link'], ['code', 'codeblock'], ['scrollSync']]}
                             />
                          </div>
                       </div>
                    )}

                    <div className="bg-white p-10 rounded-[3rem] border-2 border-button-outline shadow-sm">
                       <div className="flex justify-between items-center mb-8">
                          <label className="text-xs font-black text-text-caption uppercase">3. 답안 및 보기 설정 (Answers)</label>
                          {(editorForm.type === 'MULTIPLE_CHOICE' || editorForm.type === 'FILL_IN_THE_BLANK') && (
                            <button onClick={addOption} className="bg-primary text-white px-4 py-2 rounded-xl font-black text-xs hover:bg-primary-strong transition shadow-md flex items-center space-x-1"><PlusCircle size={14} /> <span>추가</span></button>
                          )}
                       </div>
                       {editorForm.type === 'MULTIPLE_CHOICE' ? (
                          <div className="space-y-3">
                             {editorForm.options.map((opt, idx) => {
                               const isSelect = editorForm.correctAnswer.includes(String(idx));
                               return (
                                 <div key={idx} 
                                   onClick={() => {
                                      const cur = [...editorForm.correctAnswer];
                                      if(cur.includes(String(idx))) setEditorForm({...editorForm, correctAnswer: cur.filter(c => c !== String(idx))});
                                      else setEditorForm({...editorForm, correctAnswer: [...cur, String(idx)]});
                                   }}
                                   className={`flex items-center space-x-4 p-4 rounded-2xl shadow-sm border-2 transition-all cursor-pointer group/row ${isSelect ? 'bg-primary/10 border-primary shadow-md' : 'bg-bg-section border-transparent hover:border-button-outline'}`}>
                                   <button 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       const cur = [...editorForm.correctAnswer];
                                       if(cur.includes(String(idx))) setEditorForm({...editorForm, correctAnswer: cur.filter(c => c !== String(idx))});
                                       else setEditorForm({...editorForm, correctAnswer: [...cur, String(idx)]});
                                     }}
                                     className={`w-10 h-10 rounded-xl flex items-center justify-center font-black transition-all ${isSelect ? 'bg-primary text-white shadow-glow animate-in zoom-in-75' : 'bg-white border border-button-outline text-text-caption group-hover/row:border-primary/50'}`}
                                   >
                                     {idx + 1}
                                   </button>
                                   <input 
                                     value={opt} 
                                     onClick={(e) => e.stopPropagation()}
                                     onChange={e=>updateOption(idx, e.target.value)} 
                                     className="flex-1 bg-transparent border-none outline-none text-xl font-black focus:text-primary transition-colors pr-4" 
                                   />
                                   <button onClick={(e)=>{e.stopPropagation(); removeOption(idx)}} className="p-2 text-atomic-gray-200 hover:text-red-500 transition-colors"><MinusCircle size={20} /></button>
                                 </div>
                               );
                             })}
                          </div>
                       ) : (
                          <div className="bg-bg-section p-6 rounded-2xl border-2 border-button-outline border-dashed">
                             <input value={editorForm.type === 'FILL_IN_THE_BLANK' ? editorForm.options.join(', ') : editorForm.correctAnswer[0] || ''} 
                               onChange={e => {
                                  const val = e.target.value;
                                  if(editorForm.type === 'FILL_IN_THE_BLANK') setEditorForm({...editorForm, options: val.split(',').map(s=>s.trim())});
                                  else setEditorForm({...editorForm, correctAnswer: [val]});
                               }}
                               className="w-full bg-transparent border-none outline-none text-2xl font-black" 
                               placeholder={editorForm.type === 'FILL_IN_THE_BLANK' ? '쉼표로 정답 구분: 정답1, 정답2' : '정답 내용을 입력하세요'} 
                             />
                          </div>
                       )}
                    </div>

                    {/* Live Preview */}
                    <div className="mt-20 pt-16 border-t-2 border-dashed border-button-outline">
                       <h3 className="text-2xl font-black mb-8 flex items-center space-x-2 text-text-title">
                          <Target size={24} className="text-primary" />
                          <span>수험생 화면 미리보기 (Live Preview)</span>
                       </h3>
                       <div className="bg-white border-2 border-button-outline rounded-[3.5rem] p-12 shadow-inner relative min-h-[400px]">
                          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-emerald-500" />
                          <div className="space-y-10">
                             <div className="flex items-start space-x-4">
                                <div className="mt-1 px-3 py-1 bg-text-title text-white text-[10px] font-black rounded-lg">QUESTION</div>
                                <h4 className="text-2xl font-black text-text-title leading-tight whitespace-pre-wrap">{editorForm.title || '내용이 없습니다.'}</h4>
                             </div>
                             {(() => {
                                const actualPassage = editorForm.parentId 
                                   ? questions.find(q => q.id === editorForm.parentId)?.content.passage 
                                   : editorForm.passage;
                                
                                return actualPassage && (
                                   <div className="bg-bg-section/30 p-10 rounded-[2.5rem] border border-button-outline/50">
                                      <div className="prose prose-xl max-w-none text-text-title md-preview font-medium leading-loose">
                                         <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={(url) => url.startsWith('http') || url.startsWith('data:') ? url : `http://localhost:3000${url}`}>{actualPassage}</ReactMarkdown>
                                      </div>
                                   </div>
                                );
                             })()}
                             <div className="pl-14 space-y-4">
                                {editorForm.type === 'MULTIPLE_CHOICE' ? (
                                   editorForm.options.map((opt, idx) => {
                                     const isChecked = editorForm.correctAnswer.includes(String(idx));
                                     return (
                                       <div key={idx} className={`p-6 rounded-[2rem] border-2 transition-all flex items-center space-x-4 ${isChecked ? 'bg-primary/10 border-primary shadow-md' : 'border-button-outline bg-bg-section/20'}`}>
                                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-black ${isChecked ? 'bg-primary border-primary text-white shadow-glow' : 'border-button-outline text-text-caption'}`}>{idx + 1}</div>
                                          <span className="text-lg font-black text-text-title">{opt}</span>
                                        </div>
                                      );
                                   })
                                ) : (
                                   <div className="p-8 border-2 border-button-outline rounded-3xl bg-bg-section-20/50 text-text-caption font-bold italic">수험생 정답 입력 영역</div>
                                )}
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              {/* FAB */}
              <button 
                onClick={handleSaveQuestion}
                className="fixed bottom-12 right-12 w-20 h-20 bg-primary text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all z-[60] flex flex-col items-center justify-center space-y-1 border-4 border-white group"
              >
                 <Save size={28} className="group-hover:animate-bounce" />
                 <span className="text-[10px] font-black uppercase tracking-tighter">SAVE</span>
              </button>
           </div>
        )}
      </div>
    </div>
  );
}
