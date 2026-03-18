import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Auth0Provider } from '@auth0/auth0-react'
import './styles/main.scss'
import App from './App.jsx'

const domain = import.meta.env.VITE_AUTH0_DOMAIN
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID
const audience = import.meta.env.VITE_AUTH0_AUDIENCE
const authConfigured = Boolean(domain && clientId)

if (!authConfigured) {
  console.error('Auth0 configuration missing. Please check your .env file.')
  console.error('Required environment variables:')
  console.error('- VITE_AUTH0_DOMAIN')
  console.error('- VITE_AUTH0_CLIENT_ID')
  console.error('The app cannot authenticate without these values.')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {authConfigured ? (
      <Auth0Provider
        domain={domain}
        clientId={clientId}
        authorizationParams={{
          redirect_uri: window.location.origin,
          audience: audience,
          scope: 'openid profile email',
        }}
        cacheLocation="localstorage"
        onRedirectCallback={(appState) => {
          if (appState?.returnTo) {
            window.location.assign(appState.returnTo)
          }
        }}
      >
        <App />
      </Auth0Provider>
    ) : (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', padding: '24px' }}>
        <div style={{ maxWidth: '560px', background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
          <h1 style={{ marginTop: 0, marginBottom: '12px' }}>Configuration Auth0 manquante</h1>
          <p style={{ marginTop: 0 }}>Crée un fichier <code>.env</code> dans <code>front/vitalio</code> avec les variables suivantes :</p>
          <pre style={{ background: '#f6f8fa', padding: '12px', borderRadius: '8px', overflowX: 'auto' }}>
VITE_AUTH0_DOMAIN=your-tenant.eu.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_AUTH0_AUDIENCE=your-api-audience
VITE_API_URL=http:
          </pre>
          <p style={{ marginBottom: 0 }}>Ensuite relance <code>npm run dev</code>.</p>
        </div>
      </div>
    )}
  </StrictMode>,
)
