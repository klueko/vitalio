import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { ArrowLeft, Wifi, Battery, Search, Server, Power, RefreshCw, AlertOctagon } from 'lucide-react';
import { SENSORS_STATUS } from '../data/mockData';
import { adminAssociateDoctorPatient } from '../services/api';

const STATUS_LABELS = {
    online: 'En ligne',
    offline: 'Hors ligne',
    warning: 'Alerte',
};

const StatusBadge = ({ status }) => {
    const colors = {
        online: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        offline: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
        warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    };
    return (
        <span className={`px-2 py-1 rounded text-xs font-mono border ${colors[status] || colors.offline}`}>
            {STATUS_LABELS[status] || status}
        </span>
    );
};

const BatteryIndicator = ({ level }) => {
    let color = 'text-green-500';
    if (level < 20) color = 'text-red-500';
    else if (level < 50) color = 'text-amber-500';

    return (
        <div className="flex items-center gap-1">
            <Battery size={16} className={color} />
            <span className={`text-xs font-mono font-bold ${color}`}>{level}%</span>
        </div>
    );
};

const SignalIndicator = ({ strength }) => {
    let color = 'text-green-500';
    if (strength < 40) color = 'text-red-500';
    else if (strength < 70) color = 'text-amber-500';

    return (
        <div className="flex items-center gap-1">
            <Wifi size={16} className={color} />
            <span className={`text-xs font-mono font-bold ${color}`}>{strength}%</span>
        </div>
    );
};

export default function AdminView() {
    const navigate = useNavigate();
    const { getAccessTokenSilently } = useAuth0();
    const [doctorId, setDoctorId] = React.useState('');
    const [patientId, setPatientId] = React.useState('');
    const [linkMessage, setLinkMessage] = React.useState('');
    const [linkError, setLinkError] = React.useState('');

    const handleAssociate = async () => {
        try {
            setLinkError('');
            setLinkMessage('');
            const token = await getAccessTokenSilently();
            await adminAssociateDoctorPatient(token, doctorId.trim(), patientId.trim());
            setLinkMessage('Association médecin-patient créée.');
        } catch (e) {
            setLinkError(e.message || "Impossible de créer l'association");
        }
    };

    return (
        <div className="admin-container admin-theme">

            {}
            <nav className="admin-nav">
                <div className="nav-left">
                    <button onClick={() => navigate('/')} className="back-btn">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="app-info-block">
                        <h1 className="app-title">
                            <Server size={18} className="icon" />
                            VitalIO_Admin
                        </h1>
                        <p className="version">v2.4.0-stable • système : ok</p>
                    </div>
                </div>
                <div className="nav-right">
                    <span className="status-dot animate-pulse"></span>
                    <span className="status-text">Connecté</span>
                </div>
            </nav>

            <div className="admin-content">

                {}
                <div className="kpi-grid">
                    <div className="kpi-card">
                        <p className="label">Capteurs totaux</p>
                        <p className="value">42</p>
                    </div>
                    <div className="kpi-card">
                        <p className="label">En ligne</p>
                        <p className="value ok">38</p>
                    </div>
                    <div className="kpi-card">
                        <p className="label">Alertes</p>
                        <p className="value warn">3</p>
                    </div>
                    <div className="kpi-card">
                        <p className="label">Hors ligne</p>
                        <p className="value err">1</p>
                    </div>
                </div>

                {}
                <div className="toolbar">
                    <div className="search-box">
                        <Search className="icon" size={16} />
                        <input
                            type="text"
                            placeholder="Rechercher ID appareil, emplacement..."
                        />
                    </div>
                    <button className="refresh-btn">
                        <RefreshCw size={16} /> Actualiser
                    </button>
                </div>

                <div className="patient-table-section" style={{ marginBottom: '16px' }}>
                    <div className="section-header">
                        <h3>Liaison médecin / patient</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            placeholder="doctor_user_id_auth"
                            value={doctorId}
                            onChange={(event) => setDoctorId(event.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="patient_user_id_auth"
                            value={patientId}
                            onChange={(event) => setPatientId(event.target.value)}
                        />
                        <button className="refresh-btn" onClick={handleAssociate}>
                            Associer
                        </button>
                    </div>
                    {linkError && <p className="doctor-error">{linkError}</p>}
                    {linkMessage && <p>{linkMessage}</p>}
                </div>

                {}
                <div className="devices-grid">
                    {SENSORS_STATUS.map(sensor => (
                        <div key={sensor.id} className="device-card group">
                            {sensor.status === 'warning' && <div className="warning-overlay"></div>}

                            <div className="card-header">
                                <div>
                                    <h3>{sensor.type}</h3>
                                    <p className="id-text">{sensor.id}</p>
                                </div>
                                <StatusBadge status={sensor.status} />
                            </div>

                            <div className="info-list">
                                <div className="info-row border-b">
                                    <span className="label">Emplacement</span>
                                    <span className="val">{sensor.location}</span>
                                </div>
                                <div className="info-row">
                                    <span className="label">Batterie</span>
                                    <BatteryIndicator level={sensor.battery} />
                                </div>
                                <div className="info-row">
                                    <span className="label">Signal</span>
                                    <SignalIndicator strength={sensor.signal} />
                                </div>
                            </div>

                            <div className="actions">
                                <button title="Redémarrer">
                                    <Power size={16} />
                                </button>
                                <button title="Diagnostiquer">
                                    <AlertOctagon size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}
