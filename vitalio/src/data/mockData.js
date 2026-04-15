export const CURRENT_PATIENT = {
  id: "P001",
  name: "Robert",
  age: 78,
  status: "stable", // stable, warning, critical
  vitals: {
    heartRate: { value: 72, unit: "bpm", status: "normal", trend: "stable" },
    spo2: { value: 96, unit: "%", status: "normal", trend: "down" },
    temperature: { value: 36.8, unit: "°C", status: "normal", trend: "stable" }
  },
  lastUpdate: "Il y a 10 min"
};

// Helper function to generate 7 days of history data
const generateWeekHistory = (baseSpO2, baseBPM, baseTemp) => {
  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  return days.map((day, index) => ({
    day,
    date: new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR'),
    spo2: Math.floor(baseSpO2 + (Math.random() - 0.5) * 4),
    heartRate: Math.floor(baseBPM + (Math.random() - 0.5) * 15),
    temperature: parseFloat((baseTemp + (Math.random() - 0.5) * 0.8).toFixed(1))
  }));
};

export const PATIENTS_LIST = [
  {
    id: 1,
    name: "Robert",
    age: 78,
    riskScore: 15,
    heartRate: 72,
    spo2: 96,
    temperature: 36.8,
    status: "Normal",
    lastMeasurementDate: new Date(Date.now() - 10 * 60 * 1000).getTime(),
    weekHistory: generateWeekHistory(96, 72, 36.8)
  },
  {
    id: 2,
    name: "Maria",
    age: 82,
    riskScore: 45,
    heartRate: 88,
    spo2: 94,
    temperature: 37.2,
    status: "A surveiller",
    lastMeasurementDate: new Date(Date.now() - 25 * 60 * 1000).getTime(),
    weekHistory: generateWeekHistory(94, 88, 37.2)
  },
  {
    id: 3,
    name: "Jean",
    age: 65,
    riskScore: 85,
    heartRate: 110,
    spo2: 89,
    temperature: 38.1,
    status: "Critique",
    lastMeasurementDate: new Date(Date.now() - 5 * 60 * 1000).getTime(),
    weekHistory: generateWeekHistory(89, 110, 38.1)
  },
  {
    id: 4,
    name: "Sophie",
    age: 71,
    riskScore: 10,
    heartRate: 68,
    spo2: 98,
    temperature: 36.5,
    status: "Normal",
    lastMeasurementDate: new Date(Date.now() - 45 * 60 * 1000).getTime(),
    weekHistory: generateWeekHistory(98, 68, 36.5)
  },
  {
    id: 5,
    name: "Pierre",
    age: 76,
    riskScore: 30,
    heartRate: 75,
    spo2: 95,
    temperature: 36.9,
    status: "Stable",
    lastMeasurementDate: new Date(Date.now() - 120 * 60 * 1000).getTime(),
    weekHistory: generateWeekHistory(95, 75, 36.9)
  },
  {
    id: 6,
    name: "Françoise",
    age: 69,
    riskScore: 55,
    heartRate: 92,
    spo2: 91,
    temperature: 37.8,
    status: "Critique",
    lastMeasurementDate: new Date(Date.now() - 8 * 60 * 1000).getTime(),
    weekHistory: generateWeekHistory(91, 92, 37.8)
  },
  {
    id: 7,
    name: "Michel",
    age: 84,
    riskScore: 38,
    heartRate: 78,
    spo2: 93,
    temperature: 37.0,
    status: "A surveiller",
    lastMeasurementDate: new Date(Date.now() - 35 * 60 * 1000).getTime(),
    weekHistory: generateWeekHistory(93, 78, 37.0)
  },
  {
    id: 8,
    name: "Claudette",
    age: 73,
    riskScore: 12,
    heartRate: 70,
    spo2: 97,
    temperature: 36.6,
    status: "Normal",
    lastMeasurementDate: new Date(Date.now() - 60 * 60 * 1000).getTime(),
    weekHistory: generateWeekHistory(97, 70, 36.6)
  },
  {
    id: 9,
    name: "André",
    age: 80,
    riskScore: 62,
    heartRate: 105,
    spo2: 90,
    temperature: 38.0,
    status: "Critique",
    lastMeasurementDate: new Date(Date.now() - 3 * 60 * 1000).getTime(),
    weekHistory: generateWeekHistory(90, 105, 38.0)
  },
  {
    id: 10,
    name: "Monique",
    age: 67,
    riskScore: 22,
    heartRate: 74,
    spo2: 96,
    temperature: 36.7,
    status: "Stable",
    lastMeasurementDate: new Date(Date.now() - 90 * 60 * 1000).getTime(),
    weekHistory: generateWeekHistory(96, 74, 36.7)
  },
  {
    id: 11,
    name: "Bernard",
    age: 75,
    riskScore: 48,
    heartRate: 86,
    spo2: 92,
    temperature: 37.4,
    status: "A surveiller",
    lastMeasurementDate: new Date(Date.now() - 15 * 60 * 1000).getTime(),
    weekHistory: generateWeekHistory(92, 86, 37.4)
  },
  {
    id: 12,
    name: "Jacqueline",
    age: 79,
    riskScore: 8,
    heartRate: 66,
    spo2: 98,
    temperature: 36.4,
    status: "Normal",
    lastMeasurementDate: new Date(Date.now() - 55 * 60 * 1000).getTime(),
    weekHistory: generateWeekHistory(98, 66, 36.4)
  },
  {
    id: 13,
    name: "Gérard",
    age: 72,
    riskScore: 72,
    heartRate: 108,
    spo2: 88,
    temperature: 38.3,
    status: "Critique",
    lastMeasurementDate: new Date(Date.now() - 2 * 60 * 1000).getTime(),
    weekHistory: generateWeekHistory(88, 108, 38.3)
  },
  {
    id: 14,
    name: "Denise",
    age: 68,
    riskScore: 18,
    heartRate: 71,
    spo2: 97,
    temperature: 36.5,
    status: "Normal",
    lastMeasurementDate: new Date(Date.now() - 75 * 60 * 1000).getTime(),
    weekHistory: generateWeekHistory(97, 71, 36.5)
  },
  {
    id: 15,
    name: "Raymond",
    age: 81,
    riskScore: 35,
    heartRate: 82,
    spo2: 94,
    temperature: 37.1,
    status: "Stable",
    lastMeasurementDate: new Date(Date.now() - 40 * 60 * 1000).getTime(),
    weekHistory: generateWeekHistory(94, 82, 37.1)
  },
];

export const VITALS_HISTORY = [
  { time: "08:00", heartRate: 70, spo2: 97 },
  { time: "09:00", heartRate: 72, spo2: 97 },
  { time: "10:00", heartRate: 75, spo2: 96 },
  { time: "11:00", heartRate: 71, spo2: 96 },
  { time: "12:00", heartRate: 69, spo2: 98 },
  { time: "13:00", heartRate: 74, spo2: 95 },
  { time: "14:00", heartRate: 72, spo2: 96 },
];

export const EVENTS_TODAY = [
  { id: 1, time: "08:00", type: "info", message: "Prise de mesure automatique", details: "Tous les indicateurs sont normaux." },
  { id: 2, time: "08:30", type: "check", message: "Prise médicament", details: "Validé par le patient." },
  { id: 3, time: "12:15", type: "warning", message: "SpO2 légèrement bas", details: "94% détecté. Retour à la normale à 12:20." },
  { id: 4, time: "14:00", type: "info", message: "Visite infirmière", details: "Rapport: Tout va bien." },
];

export const SENSORS_STATUS = [
  { id: "S-101", type: "Oxymètre", location: "Chambre", battery: 85, signal: 90, status: "online" },
  { id: "S-102", type: "Cardio", location: "Poignet", battery: 12, signal: 95, status: "warning" },
  { id: "S-103", type: "Hub Central", location: "Salon", battery: 100, signal: 100, status: "online" },
  { id: "S-104", type: "Tensiomètre", location: "Salle de bain", battery: 0, signal: 0, status: "offline" },
];
