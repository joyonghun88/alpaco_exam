import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, Settings, FileText, Target, LogOut, ShieldCheck } from 'lucide-react';

export default function AdminLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<any>(null);

  useEffect(() => {
    document.title = '알파코 평가시스템 관리자';
    const stored = localStorage.getItem('adminUser');
    if (stored) setAdmin(JSON.parse(stored));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/admin/login');
  };

  const navItems = [
    { path: '/admin', icon: <LayoutDashboard size={20} />, label: '대시보드' },
    { path: '/admin/questions', icon: <BookOpen size={20} />, label: '공통 문제 은행' },
    { path: '/admin/exams', icon: <FileText size={20} />, label: '시험지 관리' },
    { path: '/admin/rooms', icon: <Settings size={20} />, label: '고사장 운영 관리' },
    { path: '/admin/participants', icon: <Users size={20} />, label: '수험생 배정 관리' },
  ];

  // SUPER_ADMIN인 경우에만 계정 관리 메뉴 추가
  if (admin?.role === 'SUPER_ADMIN') {
    navItems.push({ path: '/admin/management', icon: <ShieldCheck size={20} />, label: '계정 권한 관리' });
  }

  return (
    <div className="flex h-screen bg-bg-section font-sans text-text-body">
      {/* Sidebar */}
      <aside className="w-64 bg-primary-strong text-white flex flex-col shadow-xl z-20 overflow-y-auto">
        <div className="h-16 flex items-center px-6 border-b border-atomic-navy-600 space-x-3 flex-shrink-0">
           <Target size={24} className="text-ai-accent" />
           <span className="text-lg font-extrabold tracking-widest uppercase">ALPACO EXAM</span>
        </div>
        
        <div className="px-6 py-8 flex flex-col items-center border-b border-white/5 bg-white/5 mb-4">
           <div className="w-12 h-12 rounded-2xl bg-ai-accent flex items-center justify-center text-primary-strong font-black text-xl mb-3 shadow-lg">
              {admin?.name?.charAt(0) || 'A'}
           </div>
           <div className="text-sm font-black">{admin?.name || '관리자'}</div>
           <div className="text-[10px] font-bold text-ai-accent opacity-60 uppercase tracking-widest mt-1">{admin?.role || 'MANAGER'}</div>
        </div>

        <nav className="flex-1 space-y-2 px-4">
          {navItems.map(item => {
            const active = loc.pathname === item.path || (item.path !== '/admin' && loc.pathname.startsWith(item.path));
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-bold ${active ? 'bg-ai-accent text-primary-strong shadow-lg shadow-ai-accent/10' : 'text-atomic-gray-300 hover:bg-white/10 hover:text-white'}`}
              >
                {item.icon}
                <span className="text-sm">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-atomic-navy-600 flex-shrink-0">
           <button 
             onClick={handleLogout}
             className="flex items-center space-x-2 text-atomic-gray-400 hover:text-white w-full px-4 py-3 hover:bg-red-500/20 hover:text-red-300 rounded-xl transition-all"
           >
             <LogOut size={18} />
             <span className="text-sm font-bold">시스템 로그아웃</span>
           </button>
        </div>
      </aside>
      
      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-bg-default border-b border-button-outline px-8 flex items-center justify-between z-10 shadow-sm flex-shrink-0">
           <h2 className="text-lg font-bold text-text-title tracking-wider flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-ai-accent animate-pulse" />
              <span>ADMIN CONTROL PORTAL</span>
           </h2>
           <div className="flex items-center space-x-4">
              <div className="text-[10px] font-black text-text-caption uppercase bg-bg-section px-3 py-1.5 rounded-lg">Connected: {new Date().toLocaleDateString()}</div>
              <div className="text-[11px] font-black text-primary px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20">Operational Phase</div>
           </div>
        </header>
        {/* Scrollable Content */}
        <main className="flex-1 p-8 overflow-y-auto dark-scroll">
           <Outlet />
        </main>
      </div>
    </div>
  );
}
