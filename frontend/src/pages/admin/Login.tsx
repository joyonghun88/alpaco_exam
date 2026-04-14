import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, User, ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('adminToken', data.access_token);
        localStorage.setItem('adminUser', JSON.stringify(data.admin));
        navigate('/admin/dashboard');
      } else {
        setError(data.message || '로그인에 실패했습니다.');
      }
    } catch {
      setError('서버와 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-section p-4">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-ai-accent blur-[140px] opacity-20 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary blur-[140px] opacity-10 pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-10 z-10 border border-button-outline">
        <div className="text-center mb-8">
           <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <ShieldCheck size={32} className="text-primary" />
           </div>
           <h2 className="text-3xl font-black text-text-title tracking-tight">관리자 로그인</h2>
           <p className="text-text-caption font-bold mt-2 uppercase tracking-widest text-[10px]">Alpaco Exam Management</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold animate-in slide-in-from-top-2">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-text-caption uppercase tracking-widest ml-1">Username</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-text-caption" size={18} />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디를 입력하세요"
                className="w-full pl-12 pr-6 py-4 bg-bg-section border-2 border-transparent focus:border-primary rounded-2xl outline-none transition-all font-bold text-text-title"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-text-caption uppercase tracking-widest ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-caption" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="w-full pl-12 pr-6 py-4 bg-bg-section border-2 border-transparent focus:border-primary rounded-2xl outline-none transition-all font-bold text-text-title"
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 py-5 bg-primary text-white rounded-[1.8rem] font-black text-lg shadow-xl shadow-primary/20 hover:bg-primary-strong transition-all disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인 하기'}
            {!loading && <ArrowRight size={20} className="ml-2" />}
          </button>
        </form>

        <div className="mt-10 text-center">
           <p className="text-xs text-text-caption font-medium">관리자 계정이 없으신가요? 시스템 관리자에게 문의하세요.</p>
        </div>
      </div>
    </div>
  );
}
