import { useState, useEffect } from 'react';
import { UserPlus, Shield, Trash2, History, Activity, Globe, Clock } from 'lucide-react';
import { API_BASE_URL } from '../../config';

interface Admin {
  id: string;
  username: string;
  name: string;
  role: string;
  createdAt: string;
}

interface AdminLog {
  id: string;
  action: string;
  details: string;
  ipAddress: string;
  createdAt: string;
  admin: {
    name: string;
    username: string;
  };
}

export default function AdminManagement() {
  const [activeTab, setActiveTab] = useState<'LIST' | 'LOGS'>('LIST');
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '', name: '', role: 'MANAGER' });

  const authHeader = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` };

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/auth/admins`, {
        headers: authHeader
      });
      if (res.ok) setAdmins(await res.json());
    } catch {}
    setLoading(false);
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/auth/logs`, {
        headers: authHeader
      });
      if (res.ok) setLogs(await res.json());
    } catch {}
    setLoading(false);
  };

  const handleRegister = async (e: any) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/admin/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(newAdmin)
      });
      if (res.ok) {
        alert('관리자 계정이 등록되었습니다.');
        setShowAddForm(false);
        setNewAdmin({ username: '', password: '', name: '', role: 'MANAGER' });
        fetchAdmins();
      } else {
        const data = await res.json();
        alert(data.message);
      }
    } catch {
      alert('등록 중 오류가 발생했습니다.');
    }
  };

  const updateRole = async (id: string, role: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/auth/admins/${id}/role`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({ role })
      });
      if (res.ok) fetchAdmins();
    } catch {}
  };

  useEffect(() => {
    if (activeTab === 'LIST') fetchAdmins();
    else fetchLogs();
  }, [activeTab]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-text-title tracking-tight">관리자 및 보안 설정</h1>
          <p className="text-text-caption mt-1 font-medium">시스템 운영진 관리 및 감사 로그 확인</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="bg-bg-section p-1 rounded-2xl border border-button-outline flex mr-4">
             <button 
               onClick={() => setActiveTab('LIST')}
               className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'LIST' ? 'bg-white shadow-md text-primary' : 'text-text-caption'}`}
             >
               계정 관리
             </button>
             <button 
               onClick={() => setActiveTab('LOGS')}
               className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'LOGS' ? 'bg-white shadow-md text-primary' : 'text-text-caption'}`}
             >
               접속 및 활동 로그
             </button>
          </div>
          {activeTab === 'LIST' && (
            <button 
              onClick={() => setShowAddForm(true)}
              className="flex items-center space-x-2 bg-primary text-white px-6 py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:bg-primary-strong transition-all"
            >
              <UserPlus size={18} />
              <span>신규 운영진 등록</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'LIST' ? (
        <div className="bg-white border border-button-outline rounded-[2.5rem] shadow-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-bg-section/50 text-text-caption border-b border-button-outline">
              <tr>
                <th className="px-10 py-5 text-[11px] font-black uppercase tracking-widest">Administrator</th>
                <th className="px-10 py-5 text-[11px] font-black uppercase tracking-widest">Username</th>
                <th className="px-10 py-5 text-[11px] font-black uppercase tracking-widest">Current Role</th>
                <th className="px-10 py-5 text-[11px] font-black uppercase tracking-widest">Created At</th>
                <th className="px-10 py-5 text-[11px] font-black uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-button-outline">
              {admins.map(admin => (
                <tr key={admin.id} className="hover:bg-bg-section/10 transition-colors">
                  <td className="px-10 py-6 font-black text-text-title">{admin.name}</td>
                  <td className="px-10 py-6 font-mono text-xs text-text-caption">{admin.username}</td>
                  <td className="px-10 py-6">
                     <select 
                       value={admin.role}
                       disabled={admin.role === 'SUPER_ADMIN'}
                       onChange={(e) => updateRole(admin.id, e.target.value)}
                       className={`px-4 py-1.5 rounded-xl text-xs font-black outline-none border-2 transition-all ${
                         admin.role === 'SUPER_ADMIN' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' :
                         admin.role === 'MANAGER' ? 'bg-bg-default text-text-title border-button-outline' :
                         'bg-bg-section text-text-caption border-transparent'
                       } disabled:opacity-60 disabled:cursor-not-allowed`}
                     >
                       <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                       <option value="MANAGER">MANAGER</option>
                       <option value="VIEWER">VIEWER</option>
                     </select>
                  </td>
                  <td className="px-10 py-6 text-xs text-text-caption font-medium">
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-10 py-6 text-right">
                    <button className="p-2 text-text-caption hover:text-red-500 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
           {logs.map(log => (
             <div key={log.id} className="bg-white border border-button-outline rounded-3xl p-6 flex items-center justify-between hover:shadow-lg transition-all group">
                <div className="flex items-center space-x-6">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                     log.action === 'LOGIN' ? 'bg-emerald-50 text-emerald-600' : 
                     log.action.includes('REGISTER') ? 'bg-primary/10 text-primary' : 
                     'bg-amber-50 text-amber-600'
                   }`}>
                      {log.action === 'LOGIN' ? <Activity size={24} /> : <Shield size={24} />}
                   </div>
                   <div>
                      <div className="flex items-center space-x-2">
                         <span className="font-black text-text-title">{log.admin.name}</span>
                         <span className="text-xs text-text-caption font-bold">(@{log.admin.username})</span>
                         <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                           log.action === 'LOGIN' ? 'bg-emerald-100 text-emerald-700' : 'bg-bg-section text-text-caption'
                         }`}>
                           {log.action}
                         </span>
                      </div>
                      <p className="text-sm text-text-caption font-medium mt-1">{log.details}</p>
                   </div>
                </div>
                <div className="flex items-center space-x-8 text-right">
                   <div>
                      <div className="flex items-center justify-end space-x-1 text-xs font-bold text-text-caption mb-1">
                         <Globe size={12} />
                         <span>IP Address</span>
                      </div>
                      <p className="font-mono text-xs text-text-title">{log.ipAddress || 'Internal'}</p>
                   </div>
                   <div className="w-40">
                      <div className="flex items-center justify-end space-x-1 text-xs font-bold text-text-caption mb-1">
                         <Clock size={12} />
                         <span>Captured At</span>
                      </div>
                      <p className="text-xs font-black text-text-title">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                   </div>
                </div>
             </div>
           ))}
           {logs.length === 0 && (
             <div className="py-20 text-center bg-white border-2 border-dashed border-button-outline rounded-[3rem]">
                <History size={48} className="mx-auto text-atomic-gray-200 mb-4" />
                <p className="text-text-caption font-bold text-lg">기록된 활동 로그가 없습니다.</p>
             </div>
           )}
        </div>
      )}

      {showAddForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-text-title/40 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-10 border border-button-outline">
              <div className="flex justify-between items-start mb-8">
                 <div>
                    <h2 className="text-2xl font-black text-text-title">신규 운영진 등록</h2>
                    <p className="text-xs text-text-caption font-bold mt-1 uppercase">Create Internal Admin Account</p>
                 </div>
                 <button onClick={() => setShowAddForm(false)} className="text-text-caption">×</button>
              </div>

              <form onSubmit={handleRegister} className="space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-text-caption uppercase tracking-widest ml-1">Full Name</label>
                    <input 
                      type="text" 
                      value={newAdmin.name}
                      onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                      className="w-full mt-2 p-4 bg-bg-section border-2 border-transparent focus:border-primary rounded-2xl outline-none font-bold"
                      placeholder="성함을 입력하세요"
                      required
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-text-caption uppercase tracking-widest ml-1">Username (ID)</label>
                    <input 
                      type="text" 
                      value={newAdmin.username}
                      onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })}
                      className="w-full mt-2 p-4 bg-bg-section border-2 border-transparent focus:border-primary rounded-2xl outline-none font-bold"
                      placeholder="로그인 아이디"
                      required
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-text-caption uppercase tracking-widest ml-1">Initial Password</label>
                    <input 
                      type="password" 
                      value={newAdmin.password}
                      onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                      className="w-full mt-2 p-4 bg-bg-section border-2 border-transparent focus:border-primary rounded-2xl outline-none font-bold"
                      placeholder="초기 비밀번호"
                      required
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-text-caption uppercase tracking-widest ml-1">Administrative Role</label>
                    <select 
                      value={newAdmin.role}
                      onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}
                      className="w-full mt-2 p-4 bg-bg-section border-2 border-transparent focus:border-primary rounded-2xl outline-none font-bold"
                    >
                       <option value="MANAGER">MANAGER (운영자)</option>
                       <option value="SUPER_ADMIN">SUPER ADMIN (최고 관리자)</option>
                       <option value="VIEWER">VIEWER (관찰자)</option>
                     </select>
                 </div>

                 <button type="submit" className="w-full py-5 bg-primary text-white rounded-[2rem] font-black text-lg shadow-xl shadow-primary/20 mt-4">
                    계정 생성 완료
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
