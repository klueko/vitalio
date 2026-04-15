import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wifi, Battery, AlertTriangle, Activity, User, RefreshCw, Server, ArrowLeft, X, Smartphone, CheckCircle, TrendingUp, Users, Clock } from 'lucide-react';

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import vitalioLogo from '../logo.png';
import LoadingScreen from '../components/LoadingScreen';

// Données simulées groupées par PATIENT
const ADMIN_PATIENTS = [
    {
        id: 'P-001', name: 'Robert D.', room: '104',
        sensors: [
            { id: 'S-101', type: 'Oximètre', batt: 92, wifi: 3, retries: 1, status: 'ok', connected: true },
            { id: 'S-102', type: 'Cardio', batt: 45, wifi: 2, retries: 6, status: 'critical', error: 'Anomalie Usage (6 essais)', connected: true }
        ]
    },
    {
        id: 'P-002', name: 'Julie M.', room: '201',
        sensors: [
            { id: 'S-103', type: 'Tensiomètre', batt: 12, wifi: 3, retries: 0, status: 'warning', error: 'Batterie Faible', connected: true },
            { id: 'S-104', type: 'Balance', batt: 88, wifi: 1, retries: 1, status: 'ok', connected: true }
        ]
    },
    {
        id: 'P-003', name: 'Pierre L.', room: '105',
        sensors: [
            { id: 'S-105', type: 'Oximètre', batt: 76, wifi: 3, retries: 3, status: 'warning', error: 'Difficulté Usage', connected: true },
            { id: 'S-199', type: 'Balance', batt: 0, wifi: 0, retries: 0, status: 'offline', error: 'Hors Ligne', connected: false } // Capteur déconnecté
        ]
    },
    {
        id: 'P-004', name: 'Sarah K.', room: '302',
        sensors: [
            { id: 'S-106', type: 'Cardio', batt: 95, wifi: 3, retries: 0, status: 'ok', connected: true }
        ]
    },
];

// Données Analytics Produit (MOCK)
const EFFICIENCY_DATA = [
    { day: 'L', time: 120 },
    { day: 'M', time: 95 },
    { day: 'M', time: 80 },
    { day: 'J', time: 60 },
    { day: 'V', time: 50 },
    { day: 'S', time: 45 },
    { day: 'D', time: 42 },
];

const ADOPTION_DATA = [
    { name: 'Constantes', value: 92, color: '#10B981' }, // High
    { name: 'Messagerie', value: 65, color: '#3B82F6' }, // Good
    { name: 'Agenda', value: 40, color: '#F59E0B' },    // Warning
    { name: 'Vidéo', value: 15, color: '#EF4444' },    // Critical
];

export default function AdminView() {
    const navigate = useNavigate();
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [filter, setFilter] = useState('all'); // 'all', 'critical', 'warning'
    const [isLoading, setIsLoading] = useState(true);

    // Fonction pour calculer l'état global d'un patient
    const getPatientStatus = (patient) => {
        const connectedCount = patient.sensors.filter(s => s.connected).length;
        const totalCount = patient.sensors.length;

        if (connectedCount < totalCount) return { level: 'critical', label: 'Capteur Déconnecté', color: '#EF4444' };
        if (patient.sensors.some(s => s.status === 'critical')) return { level: 'critical', label: 'Anomalie Critique', color: '#EF4444' };
        if (patient.sensors.some(s => s.status === 'warning')) return { level: 'warning', label: 'Alerte Technique', color: '#F59E0B' };
        return { level: 'ok', label: 'Tout va bien', color: '#10B981' };
    };

    // 1. D'abord on trie par gravité
    const allSortedPatients = [...ADMIN_PATIENTS].sort((a, b) => {
        const priority = { critical: 3, warning: 2, ok: 1 };
        return priority[getPatientStatus(b).level] - priority[getPatientStatus(a).level];
    });

    // 2. Ensuite on filtre selon le KPI sélectionné
    const displayedPatients = allSortedPatients.filter(p => {
        if (filter === 'all') return true;
        return getPatientStatus(p).level === filter;
    });

    // Helper pour les badges capteurs
    const getRetryBadge = (count) => {
        if (count >= 5) return <span className="badge badge-critical">Anomalie ({count})</span>;
        if (count >= 3) return <span className="badge badge-warning">Difficulté ({count})</span>;
        return <span className="badge badge-success">OK ({count})</span>;
    };

    return (
        <div className="admin-container">
            {isLoading && <LoadingScreen onFinished={() => setIsLoading(false)} />}

            {/* Header */}
            <div className="admin-header">
                <div className="header-content">
                    <button
                        onClick={() => navigate('/')}
                        className="back-btn"
                        title="Retour Accueil"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <img
                        src={vitalioLogo}
                        alt="Logo"
                        className="header-logo"
                    />
                    <div className="header-text">
                        <h1>Supervision Technique & Analytics</h1>
                        <span className="subtitle">État du parc et maintenance</span>
                    </div>
                </div>
                <button className="refresh-btn" onClick={() => window.location.reload()}>
                    <RefreshCw size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    Actualiser
                </button>
            </div>

            {/* KPIs - CLIQUABLES */}
            <div className="kpi-grid">
                <div
                    className={`kpi-card kpi-primary ${filter === 'all' ? 'active-filter' : ''}`}
                    onClick={() => setFilter('all')}
                    style={{ cursor: 'pointer', border: filter === 'all' ? '2px solid #1F7FBF' : '1px solid #E2E8F0', transition: 'all 0.2s' }}
                >
                    <span className="label">Patients Équipés</span>
                    <span className="value">{ADMIN_PATIENTS.length}</span>
                    {filter === 'all' && <span style={{ fontSize: '0.8rem', color: '#1F7FBF', fontWeight: 600, marginTop: '0.5rem' }}>Vue d'ensemble</span>}
                </div>

                <div
                    className={`kpi-card kpi-danger ${filter === 'critical' ? 'active-filter' : ''}`}
                    onClick={() => setFilter('critical')}
                    style={{ cursor: 'pointer', border: filter === 'critical' ? '2px solid #EF4444' : '1px solid #E2E8F0', transition: 'all 0.2s' }}
                >
                    <span className="label">Anomalies Critiques</span>
                    <span className="value">
                        {ADMIN_PATIENTS.filter(p => getPatientStatus(p).level === 'critical').length}
                    </span>
                    {filter === 'critical' && <span style={{ fontSize: '0.8rem', color: '#EF4444', fontWeight: 600, marginTop: '0.5rem' }}>Filtre actif</span>}
                </div>

                <div
                    className={`kpi-card kpi-warning ${filter === 'warning' ? 'active-filter' : ''}`}
                    onClick={() => setFilter('warning')}
                    style={{ cursor: 'pointer', border: filter === 'warning' ? '2px solid #F59E0B' : '1px solid #E2E8F0', transition: 'all 0.2s' }}
                >
                    <span className="label">A Vérifier</span>
                    <span className="value">
                        {ADMIN_PATIENTS.filter(p => getPatientStatus(p).level === 'warning').length}
                    </span>
                    {filter === 'warning' && <span style={{ fontSize: '0.8rem', color: '#F59E0B', fontWeight: 600, marginTop: '0.5rem' }}>Filtre actif</span>}
                </div>
            </div>

            {/* Titre filtré */}
            <div className="section-title">
                {filter === 'all' ? 'Tous les Patients (Trié par priorité)' :
                    filter === 'critical' ? 'Patients avec Anomalies Critiques' :
                        'Patients à Vérifier'}
            </div>

            {/* Grille filtrée */}
            <div className="sensors-grid">
                {displayedPatients.length === 0 ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: '#64748B', background: 'white', borderRadius: '1rem', border: '1px solid #E2E8F0' }}>
                        <CheckCircle size={48} style={{ marginBottom: '1rem', opacity: 0.5, color: '#10B981' }} />
                        <p style={{ fontSize: '1.2rem' }}>Aucun patient dans cette catégorie.</p>
                        <p style={{ fontSize: '0.9rem' }}>Tout semble fonctionner correctement.</p>
                        <button onClick={() => setFilter('all')} style={{ marginTop: '1rem', color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                            Voir tous les patients
                        </button>
                    </div>
                ) : (
                    displayedPatients.map((patient) => {
                        const status = getPatientStatus(patient);
                        const issuesCount = patient.sensors.filter(s => s.status !== 'ok' || !s.connected).length;
                        const connectedCount = patient.sensors.filter(s => s.connected).length;
                        const totalCount = patient.sensors.length;
                        const connectionColor = connectedCount < totalCount ? '#EF4444' : '#64748B';

                        return (
                            <div
                                className="sensor-card clickable"
                                key={patient.id}
                                onClick={() => setSelectedPatient(patient)}
                                style={{
                                    borderLeft: `6px solid ${status.color}`,
                                    cursor: 'pointer',
                                    paddingRight: '2rem',
                                    position: 'relative'
                                }}
                            >
                                <div className="header" style={{ marginBottom: '0.5rem' }}>
                                    <div>
                                        <div className="device-name" style={{ fontSize: '1.25rem' }}>{patient.name}</div>
                                        <div className="device-id" style={{
                                            color: connectionColor, fontWeight: connectedCount < totalCount ? 700 : 400
                                        }}>
                                            {connectedCount}/{totalCount} Capteurs connectés
                                        </div>
                                    </div>
                                    <div style={{
                                        background: status.level === 'ok' ? '#DCFCE7' : status.level === 'critical' ? '#FEE2E2' : '#FEF3C7',
                                        color: status.color,
                                        padding: '0.5rem 1rem', borderRadius: '999px', fontWeight: 700, fontSize: '0.85rem',
                                        display: 'flex', alignItems: 'center', gap: '0.5rem'
                                    }}>
                                        {status.level === 'critical' ? <AlertTriangle size={16} /> : status.level === 'warning' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                                        {status.label}
                                    </div>
                                </div>

                                {/* Résumé des problèmes si anomalies */}
                                {issuesCount > 0 && (
                                    <div style={{ marginTop: '1rem', background: '#F8FAFC', padding: '0.75rem', borderRadius: '0.5rem' }}>
                                        <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '0.5rem', fontWeight: 600 }}>DÉTAIL INCIDENTS :</div>
                                        {patient.sensors.filter(s => s.status !== 'ok' || !s.connected).map(s => (
                                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0F172A', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: (!s.connected || s.status === 'critical') ? '#EF4444' : '#F59E0B' }}></span>
                                                <b>{s.type}</b> : {!s.connected ? 'Hors Ligne' : s.error}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Chevron indicateur */}
                                <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#CBD5E1' }}>
                                    <ArrowLeft size={24} style={{ transform: 'rotate(180deg)' }} />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* --- ANALYTICS PRODUIT --- */}
            <div className="section-title" style={{ marginTop: '3rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <TrendingUp size={24} color="#6366F1" />
                Analytics Produit & Engagement
            </div>

            <div className="analytics-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '1.5rem',
                marginBottom: '4rem'
            }}>
                {/* 1. Efficacité Médicale (Line Chart) */}
                <div className="card-viz" style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0' }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Clock size={18} color="#6366F1" />
                            Temps moyen de réponse
                        </h3>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748B' }}>Objectif &lt; 1min atteint ✅</p>
                    </div>
                    <div style={{ height: '200px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={EFFICIENCY_DATA}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} width={30} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    formatter={(value) => [`${value}s`, 'Temps']}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="time"
                                    stroke="#6366F1"
                                    strokeWidth={3}
                                    dot={{ fill: '#6366F1', strokeWidth: 2, r: 4, stroke: 'white' }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Adoption Fonctionnalités (Bar Chart) */}
                <div className="card-viz" style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0' }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1E293B' }}>Adoption Fonctionnalités</h3>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748B' }}>% d'utilisateurs actifs/semaine</p>
                    </div>
                    <div style={{ height: '200px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={ADOPTION_DATA} barSize={20} margin={{ left: 10, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(241, 245, 249, 0.4)' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    formatter={(value) => [`${value}%`, 'Utilisation']}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                    {ADOPTION_DATA.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Stickiness / Engagement */}
                <div className="card-viz" style={{
                    background: 'linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%)',
                    borderRadius: '1rem', padding: '2rem',
                    boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)',
                    color: 'white',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', opacity: 0.9 }}>
                        <Users size={24} />
                        <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>Engagement</span>
                    </div>

                    <div style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1, margin: '1rem 0' }}>
                        80%
                    </div>

                    <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        28 / 35 Médecins
                    </div>

                    <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                        Actifs Aujourd'hui
                    </div>

                    <div style={{ marginTop: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.2)', padding: '0.5rem 1rem', borderRadius: '0.5rem', width: 'fit-content' }}>
                        <TrendingUp size={16} />
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Excellent Score</span>
                    </div>
                </div>
            </div>

            {/* --- MODALE DE DIAGNOSTIC --- */}
            {selectedPatient && (
                <div className="modal-overlay" style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
                }} onClick={() => setSelectedPatient(null)}>
                    <div className="diagnostic-modal" onClick={e => e.stopPropagation()} style={{
                        background: 'white', width: '90%', maxWidth: '800px', borderRadius: '1.5rem',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden',
                        animation: 'slideUp 0.3s ease'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '2rem', borderBottom: '1px solid #E2E8F0',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: '#F8FAFC'
                        }}>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#1E293B' }}>
                                    Diagnostic : {selectedPatient.name}
                                </h2>
                                <p style={{ margin: '0.5rem 0 0 0', color: '#64748B' }}>Chambre {selectedPatient.room} • {selectedPatient.sensors.length} Capteurs connectés</p>
                            </div>
                            <button onClick={() => setSelectedPatient(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', '&:hover': { background: '#E2E8F0' } }}>
                                <X size={28} color="#64748B" />
                            </button>
                        </div>

                        {/* Modal Content - Liste des capteurs détaillée */}
                        <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
                            {selectedPatient.sensors.map(sensor => (
                                <div key={sensor.id} style={{
                                    border: `1px solid ${(!sensor.connected || sensor.status === 'critical') ? '#EF4444' : sensor.status === 'warning' ? '#F59E0B' : '#E2E8F0'}`,
                                    background: (!sensor.connected || sensor.status === 'critical') ? '#FEF2F2' : sensor.status === 'warning' ? '#FFFBEB' : 'white',
                                    borderRadius: '1rem', padding: '1.5rem', position: 'relative'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <div style={{ fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Smartphone size={20} color="#6366F1" /> {sensor.type}
                                        </div>
                                        <span style={{ fontFamily: 'monospace', color: '#94A3B8', fontSize: '0.85rem' }}>{sensor.id}</span>
                                    </div>

                                    {/* Métriques Techniques */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: sensor.batt < 20 ? '#EF4444' : '#0F172A' }}>
                                            <Battery size={20} />
                                            <span style={{ fontWeight: 600 }}>{sensor.batt}%</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: !sensor.connected || sensor.wifi < 2 ? (!sensor.connected ? '#EF4444' : '#F59E0B') : '#0F172A' }}>
                                            <Wifi size={20} />
                                            <span style={{ fontWeight: 600 }}>
                                                {!sensor.connected ? 'Déconnecté' : (sensor.wifi >= 3 ? 'Excellente' : sensor.wifi === 2 ? 'Moyenne' : 'Faible')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Analyse Usage */}
                                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '1rem' }}>
                                        <div style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '0.5rem' }}>ANALYSE USAGE</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>Tentatives de mesure :</span>
                                            {getRetryBadge(sensor.retries)}
                                        </div>
                                        {(sensor.status !== 'ok' || !sensor.connected) && (
                                            <div style={{ marginTop: '1rem', color: (sensor.status === 'critical' || !sensor.connected) ? '#B91C1C' : '#B45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <AlertTriangle size={18} />
                                                {!sensor.connected ? 'Capteur Hors Ligne' : (sensor.error || 'Problème technique détecté')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
