
import React, { useEffect, useState } from 'react';
import vitalioLogo from '../logo.png';

export default function LoadingScreen({ onFinished }) {
    const [isVisible, setIsVisible] = useState(true);
    const [statusText, setStatusText] = useState('Initialisation de la connexion sécurisée');

    useEffect(() => {
        // Séquence de messages pour simuler un chargement réaliste
        const timers = [];

        timers.push(setTimeout(() => setStatusText('Récupération de vos données patients'), 800));
        timers.push(setTimeout(() => setStatusText('Synchronisation des capteurs IoT'), 1800));
        timers.push(setTimeout(() => setStatusText('Finalisation du tableau de bord'), 2800));

        // Fin du chargement
        timers.push(setTimeout(() => {
            setIsVisible(false);
            if (onFinished) setTimeout(onFinished, 500); // Attendre la fin de l'animation fade-out
        }, 3500)); // Durée totale simulée : 3.5s

        return () => timers.forEach(clearTimeout);
    }, [onFinished]);

    if (!isVisible) return null;

    return (
        <div className={`loading-screen ${!isVisible ? 'fade-out' : ''}`}>
            <div className="loading-content">
                <div className="loading-logo-container">
                    <div className="loading-ring"></div>
                    <img src={vitalioLogo} alt="VitalIO" className="loading-logo" />
                </div>

                <div className="loading-text-container">
                    <h2 className="loading-title">VitalIO</h2>
                    <div className="loading-status">
                        {statusText}
                    </div>
                </div>

                <div className="loading-progress-bar"></div>
            </div>
        </div>
    );
}
