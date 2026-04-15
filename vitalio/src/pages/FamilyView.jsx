import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertTriangle, Clock, User, Battery, MapPin, Phone } from 'lucide-react';
import { EVENTS_TODAY, CURRENT_PATIENT } from '../data/mockData';
import LoadingScreen from '../components/LoadingScreen';

const TimelineEvent = ({ event, last }) => {
    const isWarning = event.type === 'warning';
    const isCheck = event.type === 'check';
    const typeClass = isWarning ? 'warning' : isCheck ? 'check' : 'info';

    return (
        <div className="timeline-event">
            <div className="marker-col">
                <div className={`marker ${typeClass}`}>
                    {isWarning ? <AlertTriangle size={18} /> : isCheck ? <CheckCircle size={18} /> : <Clock size={18} />}
                </div>
                {!last && <div className="line"></div>}
            </div>
            <div className="content-col">
                <div className="card">
                    <span className="time">{event.time}</span>
                    <h4 className={isWarning ? 'warning' : 'normal'}>{event.message}</h4>
                    <p>{event.details}</p>
                </div>
            </div>
        </div>
    );
};

export default function FamilyView() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);

    return (
        <div className="family-container family-theme">
            {isLoading && <LoadingScreen onFinished={() => setIsLoading(false)} />}

            {/* Header Mobile Style */}
            <div className="family-header">
                <div className="top-bar">
                    <button onClick={() => navigate('/')} className="back-btn">
                        <ArrowLeft size={20} />
                    </button>
                    <span className="title">Profil de Robert</span>
                    <div className="w-10"></div> {/* Spacer */}
                </div>

                {/* Patient Profile Card */}
                <div className="profile-card">
                    <div className="bg-blob"></div>

                    <div className="info-row">
                        <div className="avatar">R</div>
                        <div className="details">
                            <h2>Papa</h2>
                            <p className="status">
                                <CheckCircle size={14} /> Stabilisé
                            </p>
                        </div>
                    </div>

                    {/* IoT Info Row */}
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            background: 'rgba(255,255,255,0.2)', padding: '0.4rem 0.8rem',
                            borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 500
                        }}>
                            <Battery size={16} /> 45%
                        </div>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            background: 'rgba(255,255,255,0.2)', padding: '0.4rem 0.8rem',
                            borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 500
                        }}>
                            <MapPin size={16} /> À la maison
                        </div>
                    </div>

                    <div className="footer-row">
                        <div>
                            <p className="label">Dernière mise à jour</p>
                            <p className="value">{CURRENT_PATIENT.lastUpdate}</p>
                        </div>
                        <button
                            className="action-btn"
                            onClick={() => window.location.href = 'tel:0612345678'}
                            style={{
                                background: 'white', color: '#1F7FBF', border: 'none',
                                padding: '0.6rem', borderRadius: '50%', cursor: 'pointer',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex'
                            }}
                        >
                            <Phone size={20} fill="#1F7FBF" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Timeline Section */}
            <div className="timeline-section">
                <h3>
                    <Clock size={20} className="icon" />
                    Journal d'aujourd'hui
                </h3>

                <div className="flex flex-col">
                    {EVENTS_TODAY.map((event, index) => (
                        <TimelineEvent
                            key={event.id}
                            event={event}
                            last={index === EVENTS_TODAY.length - 1}
                        />
                    ))}
                </div>
            </div>

            {/* Bottom Floating Action */}
            <div className="floating-action">
                <button>
                    <User size={20} /> Contacter Médecin
                </button>
            </div>

        </div>
    );
}
