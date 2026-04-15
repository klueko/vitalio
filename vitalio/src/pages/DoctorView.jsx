import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Activity, Bell, Settings, LogOut,
    Search, ChevronRight, X, Heart, Thermometer, Wind, UserPlus, AlertTriangle, Clock, Check
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { PATIENTS_LIST } from '../data/mockData';
import vitalioLogo from '../logo.png';
import LoadingScreen from '../components/LoadingScreen';

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
    <div className={`sidebar-item ${active ? 'active' : ''}`} onClick={onClick}>
        <Icon size={20} />
        <span>{label}</span>
    </div>
);

const StatCard = ({ title, value, trend, good, onClick }) => (
    <div className={`stat-card ${onClick ? 'clickable' : ''}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : {}}>
        <p className="title">{title}</p>
        <div className="content-row">
            <span className="value">{value}</span>
            <span className={`trend ${good ? 'good' : 'bad'}`}>
                {trend}
            </span>
        </div>
    </div>
);

// Format timestamp to readable date
const formatLastMeasurement = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) {
        return `Il y a ${diffMins} min`;
    } else if (diffMins < 1440) {
        const hours = Math.floor(diffMins / 60);
        return `Il y a ${hours}h`;
    } else {
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
};

// Vital Card Component for Modal
const VitalCard = ({ icon: Icon, label, value, unit, color }) => (
    <div className="vital-card" style={{ '--card-color': color }}>
        <div className="vital-icon">
            <Icon size={24} />
        </div>
        <div className="vital-info">
            <span className="vital-label">{label}</span>
            <span className="vital-value">{value}<span className="vital-unit">{unit}</span></span>
        </div>
    </div>
);

// Consultation Modal Component
const ConsultationsModal = ({ isOpen, onClose }) => {
    const [now, setNow] = useState(new Date());

    // Update time every minute to keep statuses fresh
    useEffect(() => {
        if (!isOpen) return;
        setNow(new Date()); // Update on open
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen) return null;

    const getStatus = (timeStr, durationStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const start = new Date(now);
        start.setHours(hours, minutes, 0, 0);

        const durationMinutes = parseInt(durationStr);
        const end = new Date(start.getTime() + durationMinutes * 60000);

        if (now > end) return 'Terminée';
        if (now >= start && now <= end) return 'En cours';
        return 'À venir';
    };

    const rawConsultations = [
        { id: 1, time: '09:00', patient: 'Mme. Dupont', type: 'Suivi Mensuel', duration: '30 min' },
        { id: 2, time: '10:30', patient: 'M. Martin', type: 'Urgence SpO2', duration: '45 min' },
        { id: 3, time: '11:45', patient: 'Mme. Bernard', type: 'Bilan Général', duration: '30 min' },
        { id: 4, time: '14:00', patient: 'M. Petit', type: 'Renouvellement', duration: '15 min' },
        { id: 5, time: '15:30', patient: 'Mme. Lefebvre', type: 'Consultation Vidéo', duration: '20 min' },
        { id: 6, time: '16:45', patient: 'M. Robert', type: 'Visite Routine', duration: '30 min' },
    ];

    const consultations = rawConsultations.map(c => ({
        ...c,
        status: getStatus(c.time, c.duration)
    }));

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div className="consultations-modal" onClick={e => e.stopPropagation()} style={{
                background: 'white', padding: '2rem', borderRadius: '1.5rem',
                width: '90%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: '#E0F2FE', padding: '0.75rem', borderRadius: '50%', color: '#1F7FBF' }}>
                            <Activity size={24} />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0F172A', margin: 0 }}>Agenda du Jour</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                        <X size={24} />
                    </button>
                </div>

                <div className="agenda-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {consultations.map((c, index) => (
                        <div key={index} style={{
                            display: 'flex', alignItems: 'center', padding: '1rem',
                            background: c.status === 'En cours' ? '#F0F9FF' : '#F8FAFC',
                            border: `1px solid ${c.status === 'En cours' ? '#BAE6FD' : '#E2E8F0'}`,
                            borderRadius: '1rem', position: 'relative'
                        }}>
                            {/* Time Column */}
                            <div style={{
                                minWidth: '80px', borderRight: '2px solid #E2E8F0', marginRight: '1rem',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <span style={{ fontWeight: '800', fontSize: '1.1rem', color: '#1F7FBF' }}>{c.time}</span>
                                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{c.duration}</span>
                            </div>

                            {/* Details Column */}
                            <div style={{ flex: 1 }}>
                                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', color: '#1e293b' }}>{c.patient}</h4>
                                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.9rem', color: '#64748B' }}>
                                    <span style={{ fontWeight: 500 }}>{c.type}</span>
                                </div>
                            </div>

                            {/* Status Badge */}
                            <div style={{
                                padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '600',
                                background: c.status === 'Terminée' ? '#DCFCE7' : c.status === 'En cours' ? '#DBEAFE' : '#F1F5F9',
                                color: c.status === 'Terminée' ? '#166534' : c.status === 'En cours' ? '#1E40AF' : '#64748B',
                            }}>
                                {c.status}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Patient Modal Component
const PatientModal = ({ patient, onClose }) => {
    if (!patient) return null;

    const lastMeasureFormatted = formatLastMeasurement(patient.lastMeasurementDate);
    const todayData = patient.weekHistory[patient.weekHistory.length - 1];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="patient-modal" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="modal-header">
                    <div className="patient-info">
                        <div className="patient-avatar">{patient.name.charAt(0)}</div>
                        <div>
                            <h2>{patient.name}, {patient.age} ans</h2>
                            <p className="last-update">Dernière mesure : {lastMeasureFormatted}</p>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                {/* Today's Vitals */}
                <div className="vitals-today">
                    <h3>Mesures du jour</h3>
                    <div className="vitals-grid">
                        <VitalCard
                            icon={Wind}
                            label="SpO2"
                            value={patient.spo2}
                            unit="%"
                            color="#1F7FBF"
                        />
                        <VitalCard
                            icon={Heart}
                            label="Rythme Cardiaque"
                            value={patient.heartRate}
                            unit=" BPM"
                            color="#ef4444"
                        />
                        <VitalCard
                            icon={Thermometer}
                            label="Température"
                            value={patient.temperature}
                            unit="°C"
                            color="#f59e0b"
                        />
                    </div>
                </div>

                {/* Charts Section */}
                <div className="charts-section">
                    <h3>Évolution sur 7 jours</h3>

                    {/* SpO2 Chart */}
                    <div className="modal-chart-card">
                        <h4><Wind size={16} /> Saturation en Oxygène (SpO2)</h4>
                        <div className="modal-chart-area">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={patient.weekHistory}>
                                    <defs>
                                        <linearGradient id="colorSpo2Modal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#1F7FBF" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#1F7FBF" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                                    <YAxis domain={[85, 100]} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: '12px',
                                            border: 'none',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                            background: 'white'
                                        }}
                                        formatter={(value) => [`${value}%`, 'SpO2']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="spo2"
                                        stroke="#1F7FBF"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorSpo2Modal)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Heart Rate Chart */}
                    <div className="modal-chart-card">
                        <h4><Heart size={16} /> Rythme Cardiaque</h4>
                        <div className="modal-chart-area">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={patient.weekHistory}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                                    <YAxis domain={[50, 130]} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: '12px',
                                            border: 'none',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                            background: 'white'
                                        }}
                                        formatter={(value) => [`${value} BPM`, 'Fréquence']}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="heartRate"
                                        stroke="#ef4444"
                                        strokeWidth={3}
                                        dot={{ r: 5, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Temperature Chart */}
                    <div className="modal-chart-card">
                        <h4><Thermometer size={16} /> Température</h4>
                        <div className="modal-chart-area">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={patient.weekHistory}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                                    <YAxis domain={[35, 40]} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: '12px',
                                            border: 'none',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                            background: 'white'
                                        }}
                                        formatter={(value) => [`${value}°C`, 'Température']}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="temperature"
                                        stroke="#f59e0b"
                                        strokeWidth={3}
                                        dot={{ r: 5, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper function to get status color
const getStatusColor = (status, riskScore) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('critique') || riskScore > 50) return 'red';
    if (statusLower.includes('surveiller') || statusLower.includes('stable')) return 'yellow';
    return 'green';
};

// Add Patient Modal Component
const AddPatientModal = ({ isOpen, onClose, onSubmit }) => {
    const [formData, setFormData] = useState({
        name: '',
        age: '',
        status: 'Normal'
    });

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (formData.name && formData.age) {
            onSubmit(formData);
            setFormData({ name: '', age: '', status: 'Normal' });
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="add-patient-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="header-content">
                        <UserPlus size={24} className="header-icon" />
                        <h2>Ajouter un nouveau patient</h2>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="add-patient-form">
                    <div className="form-group">
                        <label htmlFor="name">Nom du patient</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Ex: Jean Dupont"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="age">Âge</label>
                        <input
                            type="number"
                            id="age"
                            name="age"
                            value={formData.age}
                            onChange={handleChange}
                            placeholder="Ex: 75"
                            min="1"
                            max="120"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="status">Statut initial</label>
                        <select
                            id="status"
                            name="status"
                            value={formData.status}
                            onChange={handleChange}
                        >
                            <option value="Normal">Normal</option>
                            <option value="Stable">Stable</option>
                            <option value="A surveiller">À surveiller</option>
                            <option value="Critique">Critique</option>
                        </select>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={onClose}>
                            Annuler
                        </button>
                        <button type="submit" className="btn-submit">
                            <UserPlus size={18} />
                            Ajouter le patient
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default function DoctorView() {
    const navigate = useNavigate();
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showAllPatients, setShowAllPatients] = useState(false);
    const [showAddPatientModal, setShowAddPatientModal] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [patients, setPatients] = useState(PATIENTS_LIST);

    const [searchQuery, setSearchQuery] = useState('');
    const [showConsultationsModal, setShowConsultationsModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [sosAlerts, setSosAlerts] = useState([]);

    // --- ECOUTE DES SOS TEMPS RÉEL (Simulé via LocalStorage) ---
    useEffect(() => {
        const checkSOS = () => {
            const stored = localStorage.getItem('vitalio_sos_alert');
            if (stored) {
                try {
                    const newAlert = JSON.parse(stored);
                    // On ne traite que les alertes très récentes (< 10s) pour la démo
                    // ou celles qu'on n'a pas encore (id unique)
                    const isRecent = (Date.now() - newAlert.timestamp) < 15000;

                    if (isRecent) {
                        setSosAlerts(prev => {
                            // Éviter les doublons
                            if (prev.some(a => a.id === newAlert.id)) return prev;

                            // NOUVELLE ALERTE SOS DÉTECTÉE !
                            // On ouvre le panneau de notifs pour attirer l'attention
                            setShowNotifications(true);

                            return [newAlert, ...prev];
                        });
                    }
                } catch (e) {
                    console.error("Erreur lecture SOS", e);
                }
            }
        };

        // Polling rapide (1s) pour réactivité
        const interval = setInterval(checkSOS, 1000);

        // Écouteur d'événement storage (si tableau de bord ouvert dans un autre onglet/fenêtre)
        const handleStorage = () => checkSOS();
        window.addEventListener('storage', handleStorage);

        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    // Alertes Système (Générées depuis les données patients)
    const derivedAlerts = patients
        .filter(p => p.status === 'Critique' || p.status === 'A surveiller' || p.riskScore > 40)
        .map(p => ({
            id: `sys-${p.id}`,
            patientName: p.name,
            type: p.status === 'Critique' ? 'critical' : 'warning',
            message: p.status === 'Critique'
                ? `${p.name} - État critique détecté`
                : `${p.name} - Surveillance requise`,
            details: p.status === 'Critique'
                ? `SpO2: ${p.spo2}% | BPM: ${p.heartRate} | Temp: ${p.temperature}°C`
                : `Score de risque: ${p.riskScore}%`,
            time: formatLastMeasurement(p.lastMeasurementDate),
            read: false
        }));

    // Fusion: SOS en priorité (en haut) + Alertes Système
    const alerts = [...sosAlerts, ...derivedAlerts];

    const handlePatientClick = (patient) => {
        setSelectedPatient(patient);
    };

    const toggleShowAll = () => {
        setShowAllPatients(!showAllPatients);
    };

    // Sort and filter patients
    const sortedPatients = [...patients].sort((a, b) => b.riskScore - a.riskScore);
    const filteredPatients = sortedPatients.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    // Show all if explicit 'show all' OR if searching
    const displayedPatients = (showAllPatients || searchQuery) ? filteredPatients : filteredPatients.slice(0, 5);

    const handleCloseModal = () => {
        setSelectedPatient(null);
    };

    const handleAddPatient = (formData) => {
        const newPatient = {
            id: patients.length + 1,
            name: formData.name,
            age: parseInt(formData.age),
            riskScore: formData.status === 'Critique' ? 70 : formData.status === 'A surveiller' ? 40 : 15,
            heartRate: 72,
            spo2: 96,
            temperature: 36.8,
            status: formData.status,
            lastMeasurementDate: Date.now(),
            weekHistory: []
        };
        setPatients([...patients, newPatient]);
    };

    return (
        <div className="doctor-container doctor-theme">
            {isLoading && <LoadingScreen onFinished={() => setIsLoading(false)} />}

            {/* Patient Modal */}
            <PatientModal patient={selectedPatient} onClose={handleCloseModal} />

            {/* Consultations Modal */}
            <ConsultationsModal isOpen={showConsultationsModal} onClose={() => setShowConsultationsModal(false)} />

            {/* Add Patient Modal */}
            <AddPatientModal
                isOpen={showAddPatientModal}
                onClose={() => setShowAddPatientModal(false)}
                onSubmit={handleAddPatient}
            />

            {/* Sidebar */}
            <div className="sidebar">
                <div>
                    <div className="logo-area" onClick={() => navigate('/')}>
                        <img src={vitalioLogo} alt="VitalIO Logo" className="logo-icon" />
                        <span className="logo-text">VitalIO<span>Pro</span></span>
                    </div>

                    <div className="nav-menu">
                        <SidebarItem icon={Users} label="Mes Patients" active />
                        <SidebarItem icon={Activity} label="Monitoring" onClick={() => navigate('/monitoring')} />
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

                {/* Topbar */}
                <header>
                    <h2>Tableau de Bord</h2>
                    <div className="header-actions">
                        <div className="search-bar">
                            <Search className="icon" size={16} />
                            <input
                                type="text"
                                placeholder="Rechercher patient..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button className="add-patient-btn" onClick={() => setShowAddPatientModal(true)}>
                            <UserPlus size={18} />
                            <span>Ajouter un patient</span>
                        </button>
                        <div className="bell-container">
                            <button className="bell-btn" onClick={() => setShowNotifications(!showNotifications)}>
                                <Bell size={20} />
                                {alerts.length > 0 && <span className="badge">{alerts.length}</span>}
                            </button>
                        </div>
                    </div>
                </header>

                {/* Notifications Drawer */}
                <div className={`notifications-drawer ${showNotifications ? 'open' : ''}`}>
                    <div className="drawer-header">
                        <h3><Bell size={20} /> Alertes & Notifications</h3>
                        <button className="close-drawer" onClick={() => setShowNotifications(false)}>
                            <X size={24} />
                        </button>
                    </div>
                    <div className="drawer-content">
                        {alerts.length === 0 ? (
                            <div className="no-alerts">
                                <Check size={48} />
                                <p>Aucune alerte en cours</p>
                                <span>Tous vos patients vont bien</span>
                            </div>
                        ) : (
                            <>
                                <div className="alerts-count">
                                    <span className="count">{alerts.length}</span> alerte(s) active(s)
                                </div>
                                {alerts.map(alert => (
                                    <div key={alert.id} className={`notification-item ${alert.type}`}>
                                        <div className="notif-icon">
                                            <AlertTriangle size={20} />
                                        </div>
                                        <div className="notif-content">
                                            <p className="notif-message">{alert.message}</p>
                                            <p className="notif-details">{alert.details}</p>
                                            <span className="notif-time"><Clock size={12} /> {alert.time}</span>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>

                {/* Overlay */}
                {showNotifications && (
                    <div className="drawer-overlay" onClick={() => setShowNotifications(false)}></div>
                )}

                {/* Scrollable Content */}
                <main>

                    {/* Stats Bar */}
                    <div className="stats-bar">
                        <StatCard title="Patients Suivis" value="24" trend="+3" good={true} />
                        <StatCard title="Alertes Critiques" value="2" trend="-1" good={true} />
                        <StatCard
                            title="Consultations"
                            value="8"
                            trend="Auj."
                            good={true}
                            onClick={() => setShowConsultationsModal(true)}
                        />
                        <StatCard title="Risque Moyen" value="Medium" trend="+2%" good={false} />
                    </div>

                    <div className="dashboard-grid">

                        {/* Patient Table */}
                        <div className="patient-table-section full-width">
                            <div className="section-header">
                                <h3>{showAllPatients ? 'Tous les Patients' : 'Patients à Risque (Top 5)'}</h3>
                                <button onClick={toggleShowAll}>
                                    {showAllPatients ? 'Voir moins' : 'Voir tout'} <ChevronRight size={16} className={showAllPatients ? 'rotated' : ''} />
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table>
                                    <thead>
                                        <tr>
                                            <th className="pl-2">Patient</th>
                                            <th className="text-center">Âge</th>
                                            <th className="text-center">Score Risque</th>
                                            <th className="text-center">SpO2</th>
                                            <th className="text-center">BPM</th>
                                            <th className="text-center">Temp</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedPatients.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Search size={24} style={{ opacity: 0.5 }} />
                                                        <span>Aucun patient correspondant</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            displayedPatients.map(patient => (
                                                <tr
                                                    key={patient.id}
                                                    onClick={() => handlePatientClick(patient)}
                                                    className="clickable-row"
                                                >
                                                    <td className="pl-2 font-bold text-slate-700">
                                                        {patient.name}
                                                    </td>
                                                    <td className="text-center text-slate-500">
                                                        {patient.age} ans
                                                    </td>
                                                    <td className="text-center">
                                                        <span className={`risk-badge ${patient.riskScore > 50 ? 'high' : patient.riskScore > 20 ? 'medium' : 'low'}`}>
                                                            {patient.riskScore}%
                                                        </span>
                                                    </td>
                                                    <td className="text-center font-mono">{patient.spo2}%</td>
                                                    <td className="text-center font-mono">{patient.heartRate}</td>
                                                    <td className="text-center font-mono">{patient.temperature}°C</td>
                                                    <td>
                                                        <span className="status-wrapper">
                                                            <span className={`dot ${getStatusColor(patient.status, patient.riskScore)}`}></span>
                                                            {patient.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                </main>
            </div >
        </div >
    );
}
