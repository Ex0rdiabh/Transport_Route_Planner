import React, { useMemo, useState } from "react";

const depot = {
  id: "DEPOT",
  name: "Sitra Distribution Centre",
  area: "Sitra",
  lat: 26.154,
  lng: 50.616,
};

const initialDealers = [
  { id: "D01", name: "Al Noor Tyres", area: "Manama", lat: 26.2285, lng: 50.586, demand: 18, serviceMins: 18, priority: "High" },
  { id: "D02", name: "Bahrain Auto Hub", area: "Muharraq", lat: 26.2572, lng: 50.6119, demand: 11, serviceMins: 14, priority: "Medium" },
  { id: "D03", name: "Riffa Wheel Centre", area: "Riffa", lat: 26.129, lng: 50.555, demand: 22, serviceMins: 22, priority: "High" },
  { id: "D04", name: "Saar Motors", area: "Saar", lat: 26.1911, lng: 50.4771, demand: 9, serviceMins: 12, priority: "Low" },
  { id: "D05", name: "Isa Town Garage", area: "Isa Town", lat: 26.1736, lng: 50.5478, demand: 14, serviceMins: 16, priority: "Medium" },
  { id: "D06", name: "Hamad Town Tyres", area: "Hamad Town", lat: 26.1124, lng: 50.5126, demand: 17, serviceMins: 18, priority: "Medium" },
];

function toRad(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function optimiseNearestNeighbour(stops) {
  const remaining = [...stops];
  const route = [];
  let current = depot;

  while (remaining.length) {
    remaining.sort((a, b) => {
      const priorityWeight = { High: -0.9, Medium: -0.3, Low: 0 };
      return (
        distanceKm(current, a) + priorityWeight[a.priority] -
        (distanceKm(current, b) + priorityWeight[b.priority])
      );
    });
    const next = remaining.shift();
    route.push(next);
    current = next;
  }
  return route;
}

function calculatePlan(stops, idleMins = 0) {
  const fullRoute = [depot, ...stops, depot];
  let km = 0;

  for (let i = 0; i < fullRoute.length - 1; i++) {
    km += distanceKm(fullRoute[i], fullRoute[i + 1]);
  }

  const travelMins = (km / 38) * 60; // prototype average city speed
  const serviceMins = stops.reduce((total, stop) => total + stop.serviceMins, 0);
  const fuelLitres = km * 0.115 + idleMins * 0.035; // simple planning factor
  const demand = stops.reduce((total, stop) => total + stop.demand, 0);

  return {
    km,
    travelMins,
    serviceMins,
    totalMins: travelMins + serviceMins + idleMins,
    fuelLitres,
    demand,
  };
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function KpiCard({ label, value, helper }) {
  return (
    <div className="kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </div>
  );
}

function ProgressMap({ route, completedIndex }) {
  return (
    <div className="map-card">
      <div className="map-grid" />
      <div className="route-line" />
      <div className="depot-pin">DC</div>
      {route.map((stop, index) => (
        <div
          key={stop.id}
          className={`dealer-pin ${index < completedIndex ? "done" : index === completedIndex ? "current" : ""}`}
          style={{
            left: `${18 + (index * 67) / Math.max(route.length - 1, 1)}%`,
            top: `${index % 2 === 0 ? 35 : 61}%`,
          }}
          title={stop.name}
        >
          {index + 1}
        </div>
      ))}
      <div className="map-label">
        Prototype map view<br />
        <span>Replace with Google Maps later</span>
      </div>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState(initialDealers);
  const [completed, setCompleted] = useState(0);
  const [idleEvents, setIdleEvents] = useState([
    { id: 1, location: "Sitra Gate", minutes: 7, reason: "Loading wait" },
  ]);

  const idleMins = idleEvents.reduce((sum, item) => sum + item.minutes, 0);
  const plan = useMemo(() => calculatePlan(route, idleMins), [route, idleMins]);
  const dealersServed = Math.min(completed, route.length);
  const routeEfficiency = Math.max(62, Math.round(100 - plan.km * 0.7 - idleMins * 0.35 + dealersServed * 3));

  const moveStop = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= route.length) return;
    const copy = [...route];
    [copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
    setRoute(copy);
    setCompleted(0);
  };

  const simulateProgress = () => {
    if (completed < route.length) {
      setCompleted(completed + 1);
      return;
    }
    setCompleted(0);
  };

  const addIdleEvent = () => {
    const samples = [
      { location: "Dealer unloading bay", minutes: 12, reason: "Unloading delay" },
      { location: "Fuel station", minutes: 9, reason: "Refuelling wait" },
      { location: "Traffic signal cluster", minutes: 6, reason: "Congestion" },
      { location: "Warehouse exit", minutes: 10, reason: "Document check" },
    ];
    const sample = samples[Math.floor(Math.random() * samples.length)];
    setIdleEvents([{ id: Date.now(), ...sample }, ...idleEvents]);
  };

  return (
    <main className="app-shell">
      <style>{styles}</style>

      <section className="hero">
        <div>
          <p className="eyebrow">Transport Planning Prototype</p>
          <h1>Dealer Route Planning & KPI Control Tower</h1>
          <p>
            Plan dealer stop sequencing before departure, then monitor route KPIs such as fuel,
            kilometres, dealers served, and idle time using simulated GPS data.
          </p>
        </div>
        <div className="hero-actions">
          <button className="primary" onClick={() => { setRoute(optimiseNearestNeighbour(route)); setCompleted(0); }}>
            Optimise Dealer Sequence
          </button>
          <button onClick={simulateProgress}>
            {completed < route.length ? "Simulate Next Dealer" : "Reset Route"}
          </button>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard label="Planned Kilometres" value={`${plan.km.toFixed(1)} km`} helper="Depot → dealers → depot" />
        <KpiCard label="Estimated Fuel" value={`${plan.fuelLitres.toFixed(1)} L`} helper="Includes idle impact" />
        <KpiCard label="Dealers Served" value={`${dealersServed}/${route.length}`} helper="GPS progress simulation" />
        <KpiCard label="Idle Time" value={formatTime(idleMins)} helper="Captured from idle events" />
        <KpiCard label="Route Duration" value={formatTime(plan.totalMins)} helper="Travel + service + idle" />
        <KpiCard label="Route Score" value={`${routeEfficiency}%`} helper="Prototype KPI score" />
      </section>

      <section className="content-grid">
        <div className="panel wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Live Route View</p>
              <h2>GPS Progress Simulation</h2>
            </div>
            <span className="status-pill">{completed === route.length ? "Completed" : "In Progress"}</span>
          </div>
          <ProgressMap route={route} completedIndex={completed} />
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">AI Planning Insight</p>
              <h2>Route Recommendation</h2>
            </div>
          </div>
          <div className="insight-box">
            <strong>Recommended action</strong>
            <p>
              Sequence high-priority dealers earlier, reduce backtracking, and flag any stop with
              idle time above 10 minutes for operational review.
            </p>
          </div>
          <ul className="mini-list">
            <li><span>Estimated tyres delivered</span><b>{plan.demand}</b></li>
            <li><span>Service time</span><b>{formatTime(plan.serviceMins)}</b></li>
            <li><span>Average fuel/km</span><b>{(plan.fuelLitres / plan.km).toFixed(2)} L/km</b></li>
          </ul>
        </div>
      </section>

      <section className="content-grid bottom">
        <div className="panel wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Before Departure</p>
              <h2>Dealer Stop Sequence</h2>
            </div>
            <small>Use ↑ ↓ to manually adjust sequence</small>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Dealer</th>
                  <th>Area</th>
                  <th>Priority</th>
                  <th>Demand</th>
                  <th>Service</th>
                  <th>Move</th>
                </tr>
              </thead>
              <tbody>
                {route.map((stop, index) => (
                  <tr key={stop.id} className={index < completed ? "completed-row" : ""}>
                    <td>{index + 1}</td>
                    <td><b>{stop.name}</b></td>
                    <td>{stop.area}</td>
                    <td><span className={`priority ${stop.priority.toLowerCase()}`}>{stop.priority}</span></td>
                    <td>{stop.demand} tyres</td>
                    <td>{stop.serviceMins} mins</td>
                    <td className="move-buttons">
                      <button onClick={() => moveStop(index, -1)}>↑</button>
                      <button onClick={() => moveStop(index, 1)}>↓</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">During Route</p>
              <h2>Idle-Time Events</h2>
            </div>
            <button onClick={addIdleEvent}>Add Idle Event</button>
          </div>

          <div className="idle-list">
            {idleEvents.map((event) => (
              <div className="idle-item" key={event.id}>
                <div>
                  <b>{event.reason}</b>
                  <span>{event.location}</span>
                </div>
                <strong>{event.minutes}m</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

const styles = `
  :root {
    color-scheme: light;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #eef2f7;
    color: #132033;
  }

  * { box-sizing: border-box; }
  body { margin: 0; background: #eef2f7; }
  button { border: 0; cursor: pointer; border-radius: 14px; padding: 10px 14px; font-weight: 700; background: #e7edf5; color: #172033; transition: 0.2s ease; }
  button:hover { transform: translateY(-1px); background: #dce6f2; }
  button.primary { background: #111827; color: white; }
  small { color: #6b7280; }

  .app-shell { max-width: 1220px; margin: 0 auto; padding: 28px; }
  .hero { display: flex; justify-content: space-between; align-items: center; gap: 20px; background: linear-gradient(135deg, #ffffff, #dce8f7); padding: 30px; border-radius: 30px; box-shadow: 0 20px 50px rgba(17,24,39,0.08); }
  .hero h1 { margin: 6px 0 10px; font-size: clamp(2rem, 5vw, 4rem); max-width: 760px; line-height: 0.96; letter-spacing: -0.05em; }
  .hero p { max-width: 720px; line-height: 1.7; color: #4b5563; margin: 0; }
  .hero-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
  .eyebrow { text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.14em; color: #2563eb !important; font-weight: 800; margin: 0; }

  .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; margin: 18px 0; }
  .kpi-card { background: white; border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 24px; padding: 18px; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05); min-height: 128px; }
  .kpi-card span { display: block; color: #64748b; font-size: 0.82rem; font-weight: 700; }
  .kpi-card strong { display: block; margin: 12px 0 8px; font-size: 1.8rem; letter-spacing: -0.04em; }
  .kpi-card small { line-height: 1.4; }

  .content-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 18px; margin-bottom: 18px; }
  .panel { background: white; border-radius: 28px; padding: 20px; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06); border: 1px solid rgba(148, 163, 184, 0.3); }
  .panel-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
  .panel h2 { margin: 4px 0 0; font-size: 1.25rem; letter-spacing: -0.02em; }
  .status-pill { background: #dcfce7; color: #166534; font-weight: 800; border-radius: 999px; padding: 8px 12px; font-size: 0.8rem; }

  .map-card { height: 360px; border-radius: 24px; background: #dbeafe; position: relative; overflow: hidden; border: 1px solid #c7d2fe; }
  .map-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(30,64,175,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,175,0.12) 1px, transparent 1px); background-size: 36px 36px; }
  .route-line { position: absolute; left: 10%; right: 8%; top: 50%; height: 7px; border-radius: 999px; background: linear-gradient(90deg, #1d4ed8, #22c55e); transform: rotate(-4deg); opacity: 0.85; }
  .depot-pin, .dealer-pin { position: absolute; width: 46px; height: 46px; border-radius: 16px; display: grid; place-items: center; color: white; font-weight: 900; box-shadow: 0 10px 24px rgba(15,23,42,0.2); }
  .depot-pin { background: #111827; left: 5%; top: 45%; }
  .dealer-pin { background: #64748b; }
  .dealer-pin.done { background: #16a34a; }
  .dealer-pin.current { background: #f97316; transform: scale(1.12); }
  .map-label { position: absolute; left: 18px; bottom: 18px; background: rgba(255,255,255,0.88); border-radius: 18px; padding: 12px 14px; font-weight: 800; }
  .map-label span { font-weight: 600; color: #64748b; font-size: 0.82rem; }

  .insight-box { background: #f8fafc; border-radius: 22px; padding: 18px; border: 1px solid #e2e8f0; }
  .insight-box p { color: #475569; line-height: 1.6; margin-bottom: 0; }
  .mini-list { list-style: none; padding: 0; margin: 16px 0 0; display: grid; gap: 10px; }
  .mini-list li { display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; color: #64748b; }
  .mini-list b { color: #111827; }

  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; min-width: 760px; }
  th { text-align: left; color: #64748b; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; }
  th, td { padding: 13px 10px; border-bottom: 1px solid #e5e7eb; }
  td { color: #334155; }
  .completed-row { background: #f0fdf4; }
  .priority { border-radius: 999px; padding: 6px 10px; font-size: 0.78rem; font-weight: 800; }
  .priority.high { background: #fee2e2; color: #991b1b; }
  .priority.medium { background: #fef3c7; color: #92400e; }
  .priority.low { background: #e0f2fe; color: #075985; }
  .move-buttons { display: flex; gap: 6px; }
  .move-buttons button { padding: 8px 10px; }

  .idle-list { display: grid; gap: 10px; max-height: 390px; overflow: auto; }
  .idle-item { display: flex; justify-content: space-between; align-items: center; gap: 12px; border: 1px solid #e5e7eb; border-radius: 18px; padding: 14px; }
  .idle-item span { display: block; color: #64748b; font-size: 0.85rem; margin-top: 3px; }
  .idle-item strong { color: #ef4444; }

  @media (max-width: 980px) {
    .hero, .content-grid { grid-template-columns: 1fr; flex-direction: column; align-items: stretch; }
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .hero-actions { justify-content: flex-start; }
  }

  @media (max-width: 620px) {
    .app-shell { padding: 14px; }
    .hero { padding: 22px; border-radius: 24px; }
    .kpi-grid { grid-template-columns: 1fr; }
    .map-card { height: 300px; }
  }
`;
