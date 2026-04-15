import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, X, ShieldCheck } from 'lucide-react';
import vitalioLogo from '../logo.png';

// Mock users database for demonstration
const MOCK_USERS = [
    { email: 'robert@patient.fr', password: 'patient123', role: 'patient', name: 'Robert' },
    { email: 'sophie@medecin.fr', password: 'medecin123', role: 'medecin', name: 'Dr. Sophie' },
    { email: 'julie@famille.fr', password: 'famille123', role: 'aidant', name: 'Julie' },
    { email: 'thomas@admin.fr', password: 'admin123', role: 'admin', name: 'Thomas' },
];

// Route mapping based on role
const ROLE_ROUTES = {
    patient: '/patient',
    medecin: '/doctor',
    aidant: '/family',
    admin: '/admin',
};

export default function Login() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [rgpdAccepted, setRgpdAccepted] = useState(false);
    const [showRGPDModal, setShowRGPDModal] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if (!rgpdAccepted) {
            setError('Veuillez accepter les conditions d\'utilisation pour continuer.');
            setIsLoading(false);
            return;
        }

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 800));

        const user = MOCK_USERS.find(
            u => u.email === formData.email && u.password === formData.password
        );

        if (user) {
            // Store user info in localStorage for session persistence
            localStorage.setItem('vitalio_user', JSON.stringify({
                email: user.email,
                name: user.name,
                role: user.role
            }));

            // Redirect based on role
            const route = ROLE_ROUTES[user.role];
            navigate(route);
        } else {
            setError('Email ou mot de passe incorrect');
        }

        setIsLoading(false);
    };

    return (
        <div className="login-container">
            {/* Animated background elements */}
            <div className="login-bg-effects">
                <div className="bg-blob blob-1"></div>
                <div className="bg-blob blob-2"></div>
                <div className="bg-blob blob-3"></div>
                <div className="pulse-ring ring-1"></div>
                <div className="pulse-ring ring-2"></div>
            </div>

            <div className="login-card animate-fade-in">
                {/* Logo Section */}
                <div className="login-logo-section">
                    <img src={vitalioLogo} alt="VitalIO Logo" className="login-logo" />
                    <p className="login-subtitle">Plateforme de Télésurveillance Médicale</p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="login-form">
                    {/* Email Field */}
                    <div className="input-group">
                        <label htmlFor="email" className="input-label">
                            <Mail size={18} />
                            <span>Email</span>
                        </label>
                        <div className="input-wrapper">
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="votre@email.fr"
                                required
                                className="login-input"
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    {/* Password Field */}
                    <div className="input-group">
                        <label htmlFor="password" className="input-label">
                            <Lock size={18} />
                            <span>Mot de passe</span>
                        </label>
                        <div className="input-wrapper">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                required
                                className="login-input"
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    {/* RGPD Checkbox */}
                    <div className="rgpd-container">
                        <label className="rgpd-label">
                            <input
                                type="checkbox"
                                checked={rgpdAccepted}
                                onChange={(e) => {
                                    setRgpdAccepted(e.target.checked);
                                    if (error) setError('');
                                }}
                                className="rgpd-checkbox"
                            />
                            <span className="rgpd-text">
                                J'accepte les{' '}
                                <button
                                    type="button"
                                    className="rgpd-link"
                                    onClick={() => setShowRGPDModal(true)}
                                >
                                    conditions d'utilisation et de stockage des données
                                </button>
                            </span>
                        </label>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="login-error animate-shake">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className={`login-button ${isLoading ? 'loading' : ''}`}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="button-loader"></div>
                        ) : (
                            <>
                                <LogIn size={20} />
                                <span>Se connecter</span>
                            </>
                        )}
                    </button>
                </form>

                {/* Demo Accounts Info */}
                <div className="demo-accounts">
                    <p className="demo-title">Comptes de démonstration :</p>
                    <div className="demo-grid">
                        <div className="demo-account">
                            <span className="demo-role patient">Patient</span>
                            <span className="demo-email">robert@patient.fr</span>
                        </div>
                        <div className="demo-account">
                            <span className="demo-role medecin">Médecin</span>
                            <span className="demo-email">sophie@medecin.fr</span>
                        </div>
                        <div className="demo-account">
                            <span className="demo-role aidant">Aidant</span>
                            <span className="demo-email">julie@famille.fr</span>
                        </div>
                        <div className="demo-account">
                            <span className="demo-role admin">Admin</span>
                            <span className="demo-email">thomas@admin.fr</span>
                        </div>
                    </div>
                    <p className="demo-hint">Mot de passe : [role]123</p>
                </div>
            </div>

            {/* RGPD Modal */}
            {showRGPDModal && (
                <div className="modal-overlay" onClick={() => setShowRGPDModal(false)}>
                    <div className="modal-content animate-scale-in" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-icon" onClick={() => setShowRGPDModal(false)}>
                            <X size={24} />
                        </button>

                        <div className="modal-header">
                            <ShieldCheck size={32} className="modal-icon" />
                            <h2>Politique de Confidentialité et RGPD</h2>
                        </div>

                        <div className="modal-body">
                            <div className="rgpd-section">
                                <h3>1. Collecte et Finalité des Données</h3>
                                <p>Dans le cadre de votre suivi médical via VitalIO, nous collectons des données de santé (fréquence cardiaque, saturation en oxygène, alertes). Ces données sont strictement nécessaires à la télésurveillance et ne sont utilisées qu'à cette fin par votre équipe médicale.</p>
                            </div>

                            <div className="rgpd-section">
                                <h3>2. Hébergement Sécurisé (HDS)</h3>
                                <p>Vos données sont stockées sur des serveurs certifiés "Hébergement de Données de Santé" (HDS) situés en France, garantissant le plus haut niveau de sécurité et de conformité avec la réglementation française.</p>
                            </div>

                            <div className="rgpd-section">
                                <h3>3. Confidentialité et Partage</h3>
                                <p>Seuls les professionnels de santé dûment authentifiés et impliqués dans votre prise en charge ont accès à vos données. Aucune donnée n'est vendue ou partagée à des tiers commerciaux.</p>
                            </div>

                            <div className="rgpd-section">
                                <h3>4. Vos Droits (Loi Informatique et Libertés)</h3>
                                <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Vous pouvez exercer ces droits en contactant notre Délégué à la Protection des Données (DPO) à l'adresse : dpo@vitalio-sante.fr.</p>
                            </div>

                            <div className="rgpd-section">
                                <h3>5. Consentement</h3>
                                <p>En cochant la case d'acceptation, vous donnez votre consentement éclairé pour le traitement de vos données de santé dans le cadre strict décrit ci-dessus.</p>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="modal-btn-primary" onClick={() => {
                                setRgpdAccepted(true);
                                setShowRGPDModal(false);
                                if (error) setError('');
                            }}>
                                J'ai lu et j'accepte
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="login-footer">
                <p>© 2026 VitalIO - Télésurveillance Médicale IoT</p>
            </footer>
        </div>
    );
}
