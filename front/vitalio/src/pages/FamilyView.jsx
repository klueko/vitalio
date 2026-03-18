import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { ArrowLeft, Search } from 'lucide-react'
import { getCaregiverPatients } from '../services/api'

function formatLastTime(timestamp) {
  if (!timestamp) return 'Aucune mesure'
  return new Date(timestamp).toLocaleString('fr-FR')
}

export default function FamilyView() {
  const navigate = useNavigate()
  const { getAccessTokenSilently } = useAuth0()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [patients, setPatients] = useState([])

  useEffect(() => {
    let mounted = true
    const loadPatients = async () => {
      try {
        setLoading(true)
        setError('')
        const token = await getAccessTokenSilently()
        const data = await getCaregiverPatients(token)
        if (mounted) {
          setPatients(Array.isArray(data.patients) ? data.patients : [])
        }
      } catch (fetchError) {
        if (mounted) {
          setError(fetchError.message || 'Impossible de charger les patients')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadPatients()
    return () => {
      mounted = false
    }
  }, [getAccessTokenSilently])

  const filteredPatients = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return patients
    return patients.filter((patient) => {
      const name = String(patient.display_name || '').toLowerCase()
      const id = String(patient.patient_id || '').toLowerCase()
      return name.includes(keyword) || id.includes(keyword)
    })
  }, [patients, query])

  return (
    <div className="doctor-container doctor-theme">
      <div className="main-content">
        <header>
          <h2>Espace aidant</h2>
          <div className="header-actions">
            <button className="bell-btn" onClick={() => navigate('/home')}>
              <ArrowLeft size={18} />
            </button>
            <div className="search-bar">
              <Search className="icon" size={16} />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher patient..."
              />
            </div>
          </div>
        </header>

        <main>
          <div className="patient-table-section">
            <div className="section-header">
              <h3>Patients associés</h3>
            </div>
            {loading && <p>Chargement en cours...</p>}
            {!loading && error && <p className="doctor-error">{error}</p>}
            {!loading && !error && (
              <table>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Identifiant</th>
                    <th>Dernière mesure</th>
                    <th>SpO2</th>
                    <th>FC</th>
                    <th>Temperature</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((patient) => (
                    <tr
                      key={patient.patient_id}
                      className="patient-row"
                      onClick={() => navigate(`/caregiver/patient/${encodeURIComponent(patient.patient_id)}`)}
                    >
                      <td>{patient.display_name}</td>
                      <td>{patient.patient_id}</td>
                      <td>{formatLastTime(patient.last_measurement?.timestamp)}</td>
                      <td>{patient.last_measurement?.spo2 ?? '-'}</td>
                      <td>{patient.last_measurement?.heart_rate ?? '-'}</td>
                      <td>{patient.last_measurement?.temperature ?? '-'}</td>
                    </tr>
                  ))}
                  {!filteredPatients.length && (
                    <tr>
                      <td colSpan="6">Aucun patient associé pour cet aidant.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
