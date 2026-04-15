import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Activity, ArrowLeft, AlertCircle, Loader2, CheckCircle, Wifi, Battery, X, User } from 'lucide-react';
import { CURRENT_PATIENT } from '../data/mockData';
import LoadingScreen from '../components/LoadingScreen';

export default function PatientView() {
    const navigate = useNavigate();
    // Auth0 n'est peut-être pas configuré dans le wrapper global, donc on le rend optionnel ou on mock
    // const { user, isAuthenticated } = useAuth0(); 
    const isAuthenticated = false; // MOCK pour l'instant pour éviter le crash si pas de Auth0Provider
    const user = null;

    // -- STATES --
    const [isLoading, setIsLoading] = useState(true);

    // History
    const [measurements, setMeasurements] = useState([]);
    const [measurementsLoading, setMeasurementsLoading] = useState(true);
    const [showAllMeasurements, setShowAllMeasurements] = useState(false);

    // Drawer State
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    // Mesure
    const [isMeasureModalOpen, setIsMeasureModalOpen] = useState(false);
    const [measureStep, setMeasureStep] = useState('searching');

    // SOS
    const [isSOSModalOpen, setIsSOSModalOpen] = useState(false);
    const [sosStep, setSosStep] = useState('countdown');
    const [countdown, setCountdown] = useState(3);

    // -- HELPERS --
    const formatDateTime = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });

        if (diffMins < 1) return `À l'instant (${timeStr})`;
        if (diffMins < 60) return `Il y a ${diffMins} min (${timeStr})`;
        if (diffHours < 24) return `Il y a ${diffHours} h (${timeStr})`;
        if (diffDays === 1) return `Hier à ${timeStr}`;
        return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }) + ` à ${timeStr}`;
    };

    const getMedicalStatus = (m) => {
        if (m.spo2 < 90 || m.heartRate > 120 || m.heartRate < 50) return 'critical';
        if (m.spo2 < 95 || m.heartRate > 100 || m.heartRate < 60) return 'warning';
        return 'normal';
    };

    // -- LOGIC --

    // Load Data (Mocked for Demo reliability since Auth0/Supabase might not be fully setup in this env)
    useEffect(() => {
        // Simulation chargement initial
        const timer = setTimeout(() => {
            // MOCK DATA GENERATION - Robust fallback
            const now = new Date();
            const mockHistory = [
                {
                    id: 'now',
                    timestamp: now.toISOString(),
                    temperature: 36.8,
                    heart_rate: 72,
                    spo2: 98
                },
                {
                    id: 'm-1',
                    timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // -2h
                    temperature: 36.9,
                    heart_rate: 75,
                    spo2: 97
                },
                {
                    id: 'm-2',
                    timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(), // -5h
                    temperature: 37.1,
                    heart_rate: 68,
                    spo2: 96
                },
                {
                    id: 'm-3',
                    timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), // -1 jour (Hier)
                    temperature: 36.7,
                    heart_rate: 70,
                    spo2: 98
                },
                {
                    id: 'm-4',
                    timestamp: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(), // -1 jour + 2h
                    temperature: 36.6,
                    heart_rate: 71,
                    spo2: 97
                },
                {
                    id: 'm-5',
                    timestamp: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(), // -2 jours
                    temperature: 37.0,
                    heart_rate: 74,
                    spo2: 95
                }
            ];

            setMeasurements(mockHistory);
            setMeasurementsLoading(false);
            setIsLoading(false); // Stop main loading screen
        }, 1500);

        return () => clearTimeout(timer);
    }, []);

    // Gestion séquence mesure (identique)
    useEffect(() => {
        let timer;
        if (isMeasureModalOpen) {
            if (measureStep === 'searching') timer = setTimeout(() => setMeasureStep('measuring'), 2000);
            else if (measureStep === 'measuring') timer = setTimeout(() => setMeasureStep('success'), 2000);
        } else {
            setMeasureStep('searching');
        }
        return () => clearTimeout(timer);
    }, [isMeasureModalOpen, measureStep]);

    // SOS Countdown
    useEffect(() => {
        let timer;
        if (isSOSModalOpen && sosStep === 'countdown') {
            if (countdown > 0) {
                timer = setTimeout(() => setCountdown(c => c - 1), 1000);
            } else {
                setSosStep('sent');
                // --- ENVOI DE L'ALERTE AU MÉDECIN (Simulé via LocalStorage) ---
                const sosAlert = {
                    id: `sos-${Date.now()}`,
                    patientName: CURRENT_PATIENT.name,
                    type: 'critical',
                    message: `SOS - ${CURRENT_PATIENT.name}`,
                    details: 'Appel d\'urgence déclenché manuellement',
                    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                    timestamp: Date.now(),
                    read: false
                };
                localStorage.setItem('vitalio_sos_alert', JSON.stringify(sosAlert));
            }
        }
        return () => clearTimeout(timer);
    }, [isSOSModalOpen, sosStep, countdown]);

    const handleSOSClick = () => { setCountdown(3); setSosStep('countdown'); setIsSOSModalOpen(true); };
    const handleCancelSOS = () => { setIsSOSModalOpen(false); setCountdown(3); };
    const handleCloseMeasure = () => { setIsMeasureModalOpen(false); setMeasureStep('searching'); };

    const displayedMeasurements = showAllMeasurements ? measurements : measurements.slice(0, 3);

    return (
        <div className="patient-container patient-theme">
            {isLoading && <LoadingScreen onFinished={() => { }} />}

            <div className="bg-circle circle-1"></div>
            <div className="bg-circle circle-2"></div>

            {/* Scrollable Main Content */}
            <div className="scrollable-content">

                {/* --- ZONE HAUTE : STATUS --- */}
                <div className="top-section">
                    <div className="header-bar">
                        <button className="back-btn" onClick={() => navigate('/')}><ArrowLeft size={24} /></button>
                        <div className="user-profile"><User size={24} /></div>
                    </div>

                    <div className="greeting">
                        <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                            Bonjour {CURRENT_PATIENT.name.split(' ')[0]}
                        </motion.h1>
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                            Tout est calme aujourd'hui
                        </motion.p>
                    </div>


                    {/* L'Orbe Central */}
                    <div className="status-orb-container" onClick={() => setIsSheetOpen(false)}>
                        <motion.div
                            className={`status-orb ${CURRENT_PATIENT.status !== 'stable' ? 'warning' : ''}`}
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <Activity size={80} strokeWidth={1.5} className="mb-2" />
                            <span className="main-status">{CURRENT_PATIENT.status === 'stable' ? 'TOUT VA BIEN' : 'ATTENTION'}</span>
                            <span className="sub-status">Dernière maj: {measurements.length > 0 ? formatDateTime(measurements[0].timestamp) : '...'}</span>
                        </motion.div>
                    </div>

                    {/* --- ACTIONS (Mesure & SOS) --- */}
                    <div className="actions-section">
                        <button
                            onClick={() => setIsMeasureModalOpen(true)}
                            className="measure-btn"
                        >
                            <Activity size={24} />
                            Prendre Mesures
                        </button>

                        <button
                            onClick={handleSOSClick}
                            className="sos-btn"
                        >
                            <AlertCircle size={28} />
                            <div style={{ display: 'flex', alignItems: 'baseline' }}>
                                <span className="label">SOS</span>
                                <span className="sos-sub">URGENCE</span>
                            </div>
                        </button>
                    </div>

                </div>
            </div>

            {/* --- BOTTOM SHEET (HISTORIQUE) --- */}
            <motion.div
                className="bottom-sheet"
                initial={{ y: "100%" }}
                animate={{ y: isSheetOpen ? 0 : "85%" }}
                transition={{ type: "spring", damping: 20, stiffness: 100 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                    if (info.offset.y < -50 || info.velocity.y < -300) setIsSheetOpen(true);
                    else if (info.offset.y > 50 || info.velocity.y > 300) setIsSheetOpen(false);
                }}
                style={{ cursor: 'grab' }}
                whileTap={{ cursor: 'grabbing' }}
                onClick={() => !isSheetOpen && setIsSheetOpen(true)}
            >
                <div className="sheet-title-container">
                    <motion.div animate={{ rotate: isSheetOpen ? 180 : 0 }} style={{ color: '#CBD5E1', marginBottom: '0.25rem', display: 'inline-block' }}>
                        <ArrowLeft size={20} style={{ transform: 'rotate(90deg)' }} />
                    </motion.div>
                    <div className="sheet-title">Historique des mesures</div>
                </div>

                {/* Contenu de l'historique dans le bottom sheet */}
                <div className="history-section">
                    <div className="section-header">
                        <h3>Derniers relevés</h3>
                        <button onClick={(e) => { e.stopPropagation(); setShowAllMeasurements(!showAllMeasurements); }}>
                            {showAllMeasurements ? 'Réduire' : 'Voir tout'}
                        </button>
                    </div>

                    {measurementsLoading ? (
                        <div style={{ textAlign: 'center', padding: '1rem', color: '#64748B' }}>Chargement...</div>
                    ) : measurements.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1rem', color: '#64748B' }}>Aucune mesure récente</div>
                    ) : (
                        <div className="history-list">
                            {displayedMeasurements.map((m) => (
                                <div key={m.id} className={`history-item ${getMedicalStatus(m)}`}>
                                    <div className="time-col">
                                        <span className="time">{formatDateTime(m.timestamp).split('(')[0]}</span>
                                        <span className="full-date">{formatDateTime(m.timestamp).split('(')[1]?.replace(')', '') || ''}</span>
                                    </div>
                                    <div className="values-col">
                                        <div className="val"><Activity size={14} /> {m.heart_rate} bpm</div>
                                        <div className="val"><Wifi size={14} /> {m.spo2}%</div>
                                        <div className="val"><Battery size={14} /> {m.temperature}°C</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>

            {/* --- MODALE MESURE --- */}
            <AnimatePresence>
                {isMeasureModalOpen && (
                    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="measure-modal" style={{ background: 'white', padding: '2rem', borderRadius: '1.5rem', width: '90%', maxWidth: '350px', textAlign: 'center' }}>
                            {measureStep === 'searching' && <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, ease: 'linear', duration: 2 }}><Wifi size={48} color="#1F7FBF" /></motion.div><h3>Recherche capteur...</h3></>}
                            {measureStep === 'measuring' && <><motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity }}><Activity size={48} color="#1F7FBF" /></motion.div><h3>Mesure...</h3></>}
                            {measureStep === 'success' && <><CheckCircle size={56} color="#22c55e" /><h3>Succès ! ✅</h3><button onClick={handleCloseMeasure} style={{ background: '#1F7FBF', color: 'white', border: 'none', padding: '0.75rem 2rem', borderRadius: '999px', marginTop: '1rem', width: '100%' }}>Fermer</button></>}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* --- MODALE SOS --- */}
            <AnimatePresence>
                {isSOSModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: '#EF4444', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: '2rem', textAlign: 'center' }}>
                        {sosStep === 'countdown' ? (
                            <><AlertCircle size={80} /><h2 style={{ fontSize: '2rem' }}>Alerte dans</h2><div style={{ fontSize: '6rem', fontWeight: 900 }}>{countdown}s</div><button onClick={handleCancelSOS} style={{ background: 'white', color: '#EF4444', padding: '1.5rem', borderRadius: '1rem', border: 'none', width: '100%', fontWeight: 'bold' }}>ANNULER</button></>
                        ) : (
                            <><CheckCircle size={80} /><h2>SECOURS PRÉVENUS</h2><p>Dr. Sophie a reçu l'alerte.</p><button onClick={() => setIsSOSModalOpen(false)} style={{ marginTop: '2rem', border: '2px solid white', background: 'transparent', color: 'white', padding: '1rem 2rem', borderRadius: '999px' }}>Fermer</button></>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
