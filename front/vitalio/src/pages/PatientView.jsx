import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { Phone, Activity, ArrowLeft, AlertCircle, LogOut } from 'lucide-react';
import { CURRENT_PATIENT } from '../data/mockData';

export default function PatientView() {
    const navigate = useNavigate();
    const { logout } = useAuth0();
    const [sosActive, setSosActive] = useState(false);
    const [sosTimer, setSosTimer] = useState(0);
    const [measuring, setMeasuring] = useState(false);

    const handleDisconnect = () => {
        logout({
            logoutParams: {
                returnTo: window.location.origin,
            },
        });
        // Clear local storage
        localStorage.removeItem('vitalio_user');
    };

    // SOS Logic: Hold for 3 seconds
    useEffect(() => {
        let interval;
        if (sosActive) {
            interval = setInterval(() => {
                setSosTimer(prev => {
                    if (prev >= 100) return 100;
                    return prev + 2; // fills in ~1-2 seconds
                });
            }, 20);
        } else {
            setSosTimer(0);
        }
        return () => clearInterval(interval);
    }, [sosActive]);

    useEffect(() => {
        if (sosTimer >= 100) {
            alert("ALERTE SOS ENVOYÉE AUX URGENCES !");
            setSosActive(false);
            setSosTimer(0);
        }
    }, [sosTimer]);

    const handleMeasure = () => {
        setMeasuring(true);
        setTimeout(() => {
            setMeasuring(false);
            alert("Mesure envoyée avec succès !");
        }, 2000);
    };

    return (
        <div className="patient-container patient-theme">
            {/* Navigation Simpifiée */}
            <button
                onClick={() => navigate('/')}
                className="back-button"
            >
                <ArrowLeft size={32} />
            </button>

            {/* Disconnect Button */}
            <button
                onClick={handleDisconnect}
                className="disconnect-button"
                title="Déconnexion"
            >
                <LogOut size={24} />
            </button>

            <div className="content-wrapper">

                {/* Header Patient */}
                <div className="patient-header">
                    <h1>Bonjour,</h1>
                    <p className="time-display">Il est 14:30</p>
                </div>

                {/* Status Indicator Giant */}
                <div className={`status-indicator ${CURRENT_PATIENT.status === 'stable' ? 'status-stable' : 'status-warning'}`}>
                    <Activity size={64} className="mb-4 animate-pulse" />
                    <span className="main-text">{CURRENT_PATIENT.status === 'stable' ? 'TOUT VA BIEN' : 'ATTENTION'}</span>
                    <span className="sub-text">Dernière maj: {CURRENT_PATIENT.lastUpdate}</span>
                </div>

                {/* Actions Grid */}
                <div className="actions-grid">

                    {/* Prise de Mesure */}
                    <button
                        onClick={handleMeasure}
                        disabled={measuring}
                        className={`measure-button ${measuring ? 'measuring' : ''}`}
                    >
                        {measuring ? (
                            <>En cours...</>
                        ) : (
                            <>
                                <div className="icon-box"><Activity size={32} /></div>
                                Prendre Mesures
                            </>
                        )}
                    </button>

                    {/* SOS Button Long Press */}
                    <button
                        onMouseDown={() => setSosActive(true)}
                        onMouseUp={() => setSosActive(false)}
                        onMouseLeave={() => setSosActive(false)}
                        onTouchStart={() => setSosActive(true)}
                        onTouchEnd={() => setSosActive(false)}
                        className="sos-button"
                    >
                        <div
                            className="progress-bar"
                            style={{ width: `${sosTimer}%` }}
                        />
                        <div className="content">
                            <AlertCircle size={48} className="mb-2" />
                            <span className="sos-text">SOS</span>
                            <span className="sos-hint">MAINTENIR POUR APPELER</span>
                        </div>
                    </button>

                </div>
            </div>
        </div>
    );
}
