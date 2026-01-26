import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { LogIn, AlertCircle } from 'lucide-react';
import vitalioLogo from '../assets/vitalio-logo.png';
import { getPatientData } from '../services/api';

// Route mapping based on role
const ROLE_ROUTES = {
    patient: '/patient',
    medecin: '/doctor',
    aidant: '/family',
    admin: '/admin',
};

export default function Login() {
    const navigate = useNavigate();
    const { 
        isAuthenticated, 
        isLoading, 
        loginWithRedirect, 
        user, 
        getAccessTokenSilently,
        error: auth0Error 
    } = useAuth0();

    // Redirect authenticated users to appropriate route
    useEffect(() => {
        if (isAuthenticated && user) {
            handleAuthenticatedUser();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, user]);

    const handleAuthenticatedUser = async () => {
        try {
            // Get user role from Auth0 user metadata or app_metadata
            const role = user['https://vitalio.app/role'] || 
                        user.app_metadata?.role || 
                        user.user_metadata?.role ||
                        'patient'; // Default role

            // Store user info in localStorage for session persistence
            localStorage.setItem('vitalio_user', JSON.stringify({
                email: user.email,
                name: user.name || user.email,
                role: role,
                picture: user.picture
            }));

            // Try to fetch patient data to verify API connection
            try {
                const token = await getAccessTokenSilently();
                await getPatientData(token);
            } catch (apiError) {
                console.warn('Could not fetch patient data:', apiError);
                // Continue anyway - API might not be available or user might not have data yet
            }

            // Redirect based on role
            const route = ROLE_ROUTES[role] || '/patient';
            navigate(route);
        } catch (error) {
            console.error('Error handling authenticated user:', error);
        }
    };

    const handleLogin = () => {
        loginWithRedirect({
            authorizationParams: {
                screen_hint: 'login',
            },
        });
    };

    if (isLoading) {
        return (
            <div className="login-container">
                <div className="login-card animate-fade-in">
                    <div className="login-logo-section">
                        <img src={vitalioLogo} alt="VitalIO Logo" className="login-logo" />
                        <h1 className="login-title">VitalIO</h1>
                        <p className="login-subtitle">Chargement...</p>
                    </div>
                </div>
            </div>
        );
    }

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
                    <h1 className="login-title">VitalIO</h1>
                    <p className="login-subtitle">Plateforme de Télésurveillance Médicale</p>
                </div>

                {/* Login Form */}
                <div className="login-form">
                    {/* Error Message */}
                    {auth0Error && (
                        <div className="login-error animate-shake">
                            <AlertCircle size={18} />
                            <span>Erreur d'authentification: {auth0Error.message}</span>
                        </div>
                    )}

                    {/* Login Button */}
                    <button 
                        type="button"
                        onClick={handleLogin}
                        className="login-button"
                    >
                        <LogIn size={20} />
                        <span>Se connecter avec Auth0</span>
                    </button>

                    <p className="login-hint">
                        Vous serez redirigé vers la page de connexion Auth0 pour vous authentifier.
                    </p>
                </div>

                {/* Info Section */}
                <div className="demo-accounts">
                    <p className="demo-title">Authentification sécurisée</p>
                    <p className="demo-hint">
                        Cette application utilise Auth0 pour une authentification sécurisée.
                        Connectez-vous avec vos identifiants Auth0 pour accéder à la plateforme.
                    </p>
                </div>
            </div>

            {/* Footer */}
            <footer className="login-footer">
                <p>© 2026 VitalIO - Télésurveillance Médicale IoT</p>
            </footer>
        </div>
    );
}
