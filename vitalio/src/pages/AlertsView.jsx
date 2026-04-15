import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Activity, Bell, Settings, LogOut,
    Check, AlertTriangle, Info, AlertCircle, Filter
} from 'lucide-react';
import vitalioLogo from '../logo.png';

// Mock Data pour les Alertes
const MOCK_ALERTS = [
    { id: 1, type: 'critical', title: 'Chute détectée', patient: 'Jean Dupont', room: '204', time: 'Il y a 2 min', read: false },
    { id: 2, type: 'critical', title: 'SpO2 critique (88%)', patient: 'Maria Garcia', room: '105', time: 'Il y a 5 min', read: false },
    { id: 3, type: 'warning', title: 'Batterie faible (15%)', patient: 'Pierre Durand', room: '302', time: 'Il y a 15 min', read: true },
    { id: 4, type: 'warning', title: 'Arythmie légère', patient: 'Sophie Laris', room: '110', time: 'Il y a 25 min', read: false },
    { id: 5, type: 'info', title: 'Capteur déconnecté', patient: 'Robert Martin', room: '201', time: 'Il y a 1h', read: true },
];

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
    <div className={`sidebar-item ${active ? 'active' : ''}`} onClick={onClick}>
        <Icon size={20} />
        <span>{label}</span>
    </div>
);

export default function AlertsView() {
    const navigate = useNavigate();
    const [filter, setFilter] = useState('all'); // all, unread, critical
    const [alerts, setAlerts] = useState(MOCK_ALERTS);

    const handleMarkAsRead = (id) => {
        setAlerts(alerts.map(a => a.id === id ? { ...a, read: true } : a));
    };

    const filteredAlerts = alerts.filter(alert => {
        if (filter === 'unread') return !alert.read;
        if (filter === 'critical') return alert.type === 'critical';
        return true;
    });

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
                        <SidebarItem icon={Activity} label="Monitoring" onClick={() => navigate('/monitoring')} />
                        <SidebarItem icon={Bell} label="Alertes" active />
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
                    <h2>Centre de Notifications</h2>
                    <div className="filter-bar" style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '0.5rem' }}>
                        {[
                            { id: 'all', label: 'Toutes' },
                            { id: 'unread', label: 'Non lues' },
                            { id: 'critical', label: 'Critiques' }
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setFilter(f.id)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '0.375rem',
                                    border: 'none',
                                    background: filter === f.id ? 'white' : 'transparent',
                                    color: filter === f.id ? '#1e293b' : '#64748b',
                                    fontWeight: filter === f.id ? 600 : 500,
                                    boxShadow: filter === f.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </header>

                <main style={{ padding: '2rem' }}>
                    <div className="alerts-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {filteredAlerts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                <Check size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                <p>Aucune alerte correspondante</p>
                            </div>
                        ) : (
                            filteredAlerts.map(alert => (
                                <div key={alert.id} className="alert-card" style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    background: alert.read ? '#f8fafc' : 'white',
                                    borderRadius: '1rem',
                                    padding: '1.25rem',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                    borderLeft: `5px solid ${alert.type === 'critical' ? '#EF4444' : alert.type === 'warning' ? '#F59E0B' : '#3B82F6'}`,
                                    transition: 'transform 0.2s',
                                    position: 'relative'
                                }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    {/* Icon */}
                                    <div style={{
                                        marginRight: '1rem',
                                        padding: '0.75rem',
                                        borderRadius: '50%',
                                        background: alert.type === 'critical' ? '#fee2e2' : alert.type === 'warning' ? '#fef3c7' : '#dbeafe',
                                        color: alert.type === 'critical' ? '#EF4444' : alert.type === 'warning' ? '#F59E0B' : '#3B82F6',
                                    }}>
                                        {alert.type === 'critical' ? <AlertCircle size={24} /> : alert.type === 'warning' ? <AlertTriangle size={24} /> : <Info size={24} />}
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: alert.read ? '#64748b' : '#1e293b' }}>
                                                {alert.title}
                                            </h3>
                                            {!alert.read && <span style={{ width: '8px', height: '8px', background: '#3B82F6', borderRadius: '50%' }}></span>}
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                                            Patient: <strong>{alert.patient}</strong> • Chambre {alert.room}
                                        </p>
                                    </div>

                                    {/* Time & Action */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{alert.time}</span>
                                        {!alert.read && (
                                            <button
                                                onClick={() => handleMarkAsRead(alert.id)}
                                                className="mark-read-btn"
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    padding: '0.375rem 0.75rem',
                                                    background: 'white',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '0.5rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    color: '#2563eb',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                }}
                                            >
                                                <Check size={12} /> Marquer vu
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
