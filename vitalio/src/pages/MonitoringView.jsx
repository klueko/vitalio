import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Activity, Bell, Settings, LogOut,
    Wifi, Battery, Activity as Pulse
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import vitalioLogo from '../logo.png';

// Mock Data pour le Monitoring
const MONITORING_DATA = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    name: ['Robert Martin', 'Maria Garcia', 'Jean Dupont', 'Sophie Laris', 'Pierre Durand', 'Julie Bernier'][i],
    bpm: 60 + Math.floor(Math.random() * 40),
    battery: 85 - Math.floor(Math.random() * 60),
    wifiStrength: 3,
    status: 'Live',
    data: Array.from({ length: 20 }, () => ({ value: 40 + Math.random() * 40 }))
}));

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
    <div className={`sidebar-item ${active ? 'active' : ''}`} onClick={onClick}>
        <Icon size={20} />
        <span>{label}</span>
    </div>
);

export default function MonitoringView() {
    const navigate = useNavigate();

    return (
        <div className="doctor-container doctor-theme">
            {/* Sidebar (Réutilisé pour la cohérence) */}
            <div className="sidebar">
                <div>
                    <div className="logo-area" onClick={() => navigate('/')}>
                        <img src={vitalioLogo} alt="VitalIO Logo" className="logo-icon" />
                        <span className="logo-text">VitalIO<span>Pro</span></span>
                    </div>

                    <div className="nav-menu">
                        <SidebarItem icon={Users} label="Mes Patients" onClick={() => navigate('/doctor')} />
                        <SidebarItem icon={Activity} label="Monitoring" active />
                        <SidebarItem icon={Bell} label="Alertes" onClick={() => navigate('/alerts')} />
                        <SidebarItem icon={Settings} label="Paramètres" />
                    </div>
                </div>

                <div className="user-profile">
                    <div className="avatar">Dr</div>
                    <div className="info">
                        <p className="name">Dr. Sophie</p>
                        <p className="role">Cardiologue</p>
                    </div>
                    <LogOut size={16} className="logout-btn" onClick={() => navigate('/')} />
                </div>
            </div>

            {/* Main Content */}
            <div className="main-content">
                <header>
                    <h2>Monitoring Temps Réel</h2>
                    <div className="header-actions">
                        <div className="status-indicator">
                            <span className="live-dot"></span>
                            Serveur IoT Connecté
                        </div>
                    </div>
                </header>

                <main style={{ padding: '2rem' }}>
                    <div className="monitoring-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '1.5rem'
                    }}>
                        {MONITORING_DATA.map(monitor => (
                            <div key={monitor.id} className="monitor-card" style={{
                                background: 'white',
                                borderRadius: '1rem',
                                padding: '1.5rem',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                border: '1px solid #e2e8f0'
                            }}>
                                {/* Card Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>{monitor.name}</h3>
                                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Device #{1000 + monitor.id}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', color: '#94a3b8' }}>
                                        <Wifi size={16} color={monitor.wifiStrength > 2 ? '#22c55e' : '#eab308'} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                            <Battery size={16} color={monitor.battery < 20 ? '#ef4444' : '#64748b'} />
                                            <span style={{ fontSize: '0.7rem' }}>{monitor.battery}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Graphique */}
                                <div style={{ height: '100px', marginBottom: '1rem' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={monitor.data}>
                                            <Line
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#1F7FBF"
                                                strokeWidth={2}
                                                dot={false}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Bottom Info */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderTop: '1px solid #f1f5f9',
                                    paddingTop: '1rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div className="live-indicator" style={{
                                            width: '8px',
                                            height: '8px',
                                            background: '#22c55e',
                                            borderRadius: '50%',
                                            boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.7)',
                                            animation: 'pulse-green 2s infinite'
                                        }}></div>
                                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                                            {monitor.bpm} BPM
                                        </span>
                                    </div>
                                    <Pulse size={20} color="#1F7FBF" />
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            </div>

            <style>{`
                @keyframes pulse-green {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
                    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
                }
                .status-indicator {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.875rem;
                    color: #22c55e;
                    background: #dcfce7;
                    padding: 0.25rem 0.75rem;
                    border-radius: 999px;
                    font-weight: 500;
                }
                .live-dot {
                    width: 6px;
                    height: 6px;
                    background: #22c55e;
                    border-radius: 50%;
                }
            `}</style>
        </div>
    );
}
