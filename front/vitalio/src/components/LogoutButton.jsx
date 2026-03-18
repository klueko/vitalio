import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { LogOut } from 'lucide-react';

export default function LogoutButton({ className = '' }) {
    const { logout } = useAuth0();

    const handleLogout = () => {
        logout({
            logoutParams: {
                returnTo: window.location.origin,
            },
        });
        
        localStorage.removeItem('vitalio_user');
    };

    return (
        <button 
            onClick={handleLogout}
            className={className}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                border: '1px solid currentColor',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                color: 'inherit',
            }}
        >
            <LogOut size={18} />
            <span>Déconnexion</span>
        </button>
    );
}
