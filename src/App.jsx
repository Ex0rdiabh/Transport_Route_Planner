import React, { useMemo, useRef, useState } from "react";

const depotAddress = "Sitra, Bahrain";

const starterDealers = [
  { id: "D01", name: "Al Noor Tyres", area: "Manama", address: "Manama, Bahrain", selected: true },
  { id: "D02", name: "Bahrain Auto Hub", area: "Muharraq", address: "Muharraq, Bahrain", selected: true },
  { id: "D03", name: "Riffa Wheel Centre", area: "Riffa", address: "Riffa, Bahrain", selected: true },
  { id: "D04", name: "Saar Motors", area: "Saar", address: "Saar, Bahrain", selected: true },
  { id: "D05", name: "Isa Town Garage", area: "Isa Town", address: "Isa Town, Bahrain", selected: false },
  { id: "D06", name: "Hamad Town Tyres", area: "Hamad Town", address: "Hamad Town, Bahrain", selected: false },
];

function loadGoogleMaps(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve(window.google);
      return;
    }

    const existingScript = document.getElementById("google-maps-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google));
      existingScript.addEventListener("error", reject);
      return;
    }

    window.__initGoogleMaps = () => resolve(window.google);

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=__initGoogleMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Google Maps failed to load. Check your API key and enabled APIs."));
    document.head.appendChild(script);
  });
}

function getFuelFactor(vehicleType) {
  return vehicleType === "Truck" ? 0.18 : 0.12;
}

function formatKm(meters) {
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatHours(seconds) {
  const totalMins = Math.round(seconds / 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
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

export default function App() {
  const mapRef = useRef(null);
  const directionsRendererRef = useRef(null);

  const [apiKey, setApiKey] = useState(localStorage.getItem("googleMapsApiKey") || "");
  const [dealers, setDealers] = useState(starterDealers);
  const [vehicleType, setVehicleType] = useState("Truck");
  const [drivers, setDrivers] = useState(1);
  const [newDealer, setNewDealer] = useState({ name: "", area: "", address: "" });
  const [routeResult, setRouteResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Add your Google Maps API key, select dealers, then generate the best journey.");

  const selectedDealers = useMemo(() => dealers.filter((dealer) => dealer.selected), [dealers]);

  const addDealer = () => {
    if (!newDealer.name.trim() || !newDealer.address.trim()) {
      setMessage("Please add at least dealer name and address/location.");
      return;
    }

    setDealers([
      ...dealers,
      {
        id: `D${Date.now()}`,
        name: newDealer.name.trim(),
        area: newDealer.area.trim() || "Custom",
        address: newDealer.address.trim(),
        selected: true,
      },
    ]);
    setNewDealer({ name: "", area: "", address: "" });
    setMessage("Dealer added to the journey list.");
  };

  const toggleDealer = (id) => {
    setDealers((current) =>
      current.map((dealer) =>
        dealer.id === id ? { ...dealer, selected: !dealer.selected } : dealer
      )
    );
  };

  const generateRoute = async () => {
    if (!apiKey.trim()) {
      setMessage("Please paste your Google Maps API key first.");
      return;
    }

    if (selectedDealers.length < 1) {
      setMessage("Select at least one dealer before generating the route.");
      return;
    }

    setLoading(true);
    setMessage("Generating optimized Google Maps route...");

    try {
      localStorage.setItem("googleMapsApiKey", apiKey.trim());
      const google = await loadGoogleMaps(apiKey.trim());

      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 26.0667, lng: 50.5577 },
        zoom: 10,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: false,
      });
      directionsRendererRef.current = directionsRenderer;

      const request = {
        origin: depotAddress,
        destination: depotAddress,
        waypoints: selectedDealers.map((dealer) => ({
          location: dealer.address,
          stopover: true,
        })),
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
        region: "BH",
      };

      directionsService.route(request, (result, status) => {
        if (status !== "OK") {
          setMessage(`Route failed: ${status}. Check the dealer addresses and API setup.`);
          setLoading(false);
          return;
        }

        directionsRenderer.setDirections(result);
        const route = result.routes[0];
        const orderedDealers = route.waypoint_order.map((index) => selectedDealers[index]);
        const totalDistance = route.legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
        const totalDuration = route.legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
        const fuelLitres = (totalDistance / 1000) * getFuelFactor(vehicleType);
        const estimatedIdleMinutes = Math.max(8, Math.round(selectedDealers.length * 7 + (vehicleType === "Truck" ? 12 : 6)));
        const driverWorkload = totalDuration / 3600 / Number(drivers || 1);
        const driverRisk = driverWorkload > 7 ? "High" : driverWorkload > 5 ? "Medium" : "Low";

        setRouteResult({
          orderedDealers,
          totalDistance,
          totalDuration,
          fuelLitres,
          estimatedIdleMinutes,
          driverRisk,
          driverWorkload,
        });
        setMessage("Optimized journey generated successfully.");
        setLoading(false);
      });
    } catch (error) {
      setMessage(error.message || "Something went wrong while loading Google Maps.");
      setLoading(false);
    }
  };

  const routeScore = routeResult
    ? Math.max(
        55,
        Math.round(
          100 -
            routeResult.totalDistance / 2000 -
            routeResult.estimatedIdleMinutes * 0.35 -
            (routeResult.driverRisk === "High" ? 10 : routeResult.driverRisk === "Medium" ? 5 : 0)
        )
      )
    : 0;

  return (
    <main className="app-shell">
      <style>{styles}</style>

      <section className="hero">
        <div>
          <p className="eyebrow">Smart Transport Planning Prototype</p>
          <h1>Dealer Journey Optimizer with Google Maps</h1>
          <p>
            Enter dealer orders, choose vehicle type, define the number of drivers, and generate
            the best route for the whole journey. The prototype also prepares the logic for future
            RFID/GPS tracker integration.
          </p>
        </div>
        <button className="primary" onClick={generateRoute} disabled={loading}>
          {loading ? "Generating..." : "Generate Best Route"}
        </button>
      </section>

      <section className="setup-grid">
        <div className="panel wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Journey Inputs</p>
              <h2>Plan Before Departure</h2>
            </div>
          </div>

          <div className="form-grid">
            <label>
              Google Maps API Key
              <input
                type="password"
                placeholder="Paste API key for prototype demo"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>

            <label>
              Vehicle Type
              <select value={vehicleType} onChange={(event) => setVehicleType(event.target.value)}>
                <option>Truck</option>
                <option>Bus</option>
              </select>
            </label>

            <label>
              No. of Drivers
              <input
                type="number"
                min="1"
                max="4"
                value={drivers}
                onChange={(event) => setDrivers(event.target.value)}
              />
            </label>
          </div>

          <div className="message-box">{message}</div>
        </div>

        <div className="panel">
          <p className="eyebrow">RFID / Tracker Concept</p>
          <h2>How Trackers Fit In</h2>
          <p className="plain-text">
            RFID identifies the vehicle/tag at gates, loading points, or dealer locations. GPS gives
            live movement, idle time, kilometres, and route deviation. Together, they create a
            stronger control-tower view.
          </p>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard
          label="Total Kilometres"
          value={routeResult ? formatKm(routeResult.totalDistance) : "--"}
          helper="Calculated by Google route legs"
        />
        <KpiCard
          label="Estimated Fuel"
          value={routeResult ? `${routeResult.fuelLitres.toFixed(1)} L` : "--"}
          helper={`${vehicleType} fuel factor used`}
        />
        <KpiCard
          label="Dealers Served"
          value={routeResult ? `${routeResult.orderedDealers.length}` : selectedDealers.length}
          helper="Selected dealer orders"
        />
        <KpiCard
          label="Idle-Time Estimate"
          value={routeResult ? `${routeResult.estimatedIdleMinutes}m` : "--"}
          helper="Replace later with tracker data"
        />
        <KpiCard
          label="Journey Duration"
          value={routeResult ? formatHours(routeResult.totalDuration) : "--"}
          helper="Driving time only"
        />
        <KpiCard
          label="Route Score"
          value={routeResult ? `${routeScore}%` : "--"}
          helper="Distance + idle + driver risk"
        />
      </section>

      <section className="content-grid">
        <div className="panel wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Google Maps Output</p>
              <h2>Optimized Journey Map</h2>
            </div>
            <span className="status-pill">Depot: {depotAddress}</span>
          </div>
          <div ref={mapRef} className="map-canvas">
            <div className="map-placeholder">
              <strong>Google Map will appear here</strong>
              <span>Paste your API key and click Generate Best Route.</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <p className="eyebrow">Best Route Sequence</p>
          <h2>Dealer Visit Order</h2>
          {routeResult ? (
            <ol className="sequence-list">
              {routeResult.orderedDealers.map((dealer) => (
                <li key={dealer.id}>
                  <b>{dealer.name}</b>
                  <span>{dealer.address}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="plain-text">The optimized dealer sequence will appear after route generation.</p>
          )}
        </div>
      </section>

      <section className="content-grid bottom">
        <div className="panel wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Dealer Orders</p>
              <h2>Select Dealers for This Journey</h2>
            </div>
          </div>

          <div className="dealer-list">
            {dealers.map((dealer) => (
              <label className="dealer-card" key={dealer.id}>
                <input
                  type="checkbox"
                  checked={dealer.selected}
                  onChange={() => toggleDealer(dealer.id)}
                />
                <div>
                  <b>{dealer.name}</b>
                  <span>{dealer.area} • {dealer.address}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Add Dealer</p>
              <h2>New Order Stop</h2>
            </div>
          </div>

          <div className="stack-form">
            <input
              placeholder="Dealer name"
              value={newDealer.name}
              onChange={(event) => setNewDealer({ ...newDealer, name: event.target.value })}
            />
            <input
              placeholder="Area, e.g. Manama"
              value={newDealer.area}
              onChange={(event) => setNewDealer({ ...newDealer, area: event.target.value })}
            />
            <input
              placeholder="Address or Google Maps location"
              value={newDealer.address}
              onChange={(event) => setNewDealer({ ...newDealer, address: event.target.value })}
            />
            <button onClick={addDealer}>Add Dealer to Route</button>
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
  button { border: 0; cursor: pointer; border-radius: 14px; padding: 11px 15px; font-weight: 800; background: #e7edf5; color: #172033; transition: 0.2s ease; }
  button:hover { transform: translateY(-1px); background: #dce6f2; }
  button.primary { background: #111827; color: white; min-width: 210px; }
  button:disabled { opacity: 0.65; cursor: wait; }
  input, select { width: 100%; border: 1px solid #d8e0ec; border-radius: 15px; padding: 12px 13px; font: inherit; background: white; outline: none; }
  input:focus, select:focus { border-color: #2563eb; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); }
  label { font-size: 0.86rem; font-weight: 800; color: #334155; display: grid; gap: 8px; }
  small { color: #6b7280; }

  .app-shell { max-width: 1240px; margin: 0 auto; padding: 28px; }
  .hero { display: flex; justify-content: space-between; align-items: center; gap: 22px; background: linear-gradient(135deg, #ffffff, #dce8f7); padding: 30px; border-radius: 30px; box-shadow: 0 20px 50px rgba(17,24,39,0.08); }
  .hero h1 { margin: 6px 0 10px; font-size: clamp(2rem, 5vw, 4rem); max-width: 780px; line-height: 0.96; letter-spacing: -0.05em; }
  .hero p { max-width: 760px; line-height: 1.7; color: #4b5563; margin: 0; }
  .eyebrow { text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.14em; color: #2563eb !important; font-weight: 900; margin: 0; }

  .setup-grid, .content-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 18px; margin-top: 18px; }
  .content-grid.bottom { margin-bottom: 18px; }
  .panel { background: white; border-radius: 28px; padding: 20px; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06); border: 1px solid rgba(148, 163, 184, 0.3); }
  .panel-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
  .panel h2 { margin: 4px 0 0; font-size: 1.25rem; letter-spacing: -0.02em; }
  .plain-text { color: #475569; line-height: 1.7; margin: 10px 0 0; }
  .status-pill { background: #eff6ff; color: #1d4ed8; font-weight: 900; border-radius: 999px; padding: 8px 12px; font-size: 0.8rem; }

  .form-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 14px; }
  .message-box { margin-top: 16px; border-radius: 18px; padding: 14px; background: #f8fafc; color: #475569; border: 1px dashed #cbd5e1; font-weight: 700; }

  .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; margin: 18px 0; }
  .kpi-card { background: white; border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 24px; padding: 18px; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05); min-height: 128px; }
  .kpi-card span { display: block; color: #64748b; font-size: 0.82rem; font-weight: 800; }
  .kpi-card strong { display: block; margin: 12px 0 8px; font-size: 1.8rem; letter-spacing: -0.04em; }
  .kpi-card small { line-height: 1.4; }

  .map-canvas { min-height: 460px; border-radius: 24px; overflow: hidden; border: 1px solid #dbe3ef; background: #dbeafe; }
  .map-placeholder { height: 460px; display: grid; place-items: center; text-align: center; color: #475569; }
  .map-placeholder strong { display: block; font-size: 1.3rem; color: #111827; }
  .map-placeholder span { display: block; margin-top: 8px; }

  .dealer-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .dealer-card { display: flex; grid-template-columns: auto 1fr; align-items: flex-start; gap: 10px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 18px; background: #f8fafc; cursor: pointer; }
  .dealer-card input { width: auto; margin-top: 4px; }
  .dealer-card b { display: block; color: #0f172a; }
  .dealer-card span { display: block; color: #64748b; margin-top: 4px; font-weight: 600; }

  .sequence-list { padding-left: 22px; display: grid; gap: 13px; }
  .sequence-list li { padding-bottom: 12px; border-bottom: 1px solid #e5e7eb; }
  .sequence-list b { display: block; color: #0f172a; }
  .sequence-list span { display: block; color: #64748b; margin-top: 4px; font-size: 0.9rem; }
  .stack-form { display: grid; gap: 11px; }

  @media (max-width: 980px) {
    .hero { flex-direction: column; align-items: stretch; }
    .setup-grid, .content-grid { grid-template-columns: 1fr; }
    .form-grid { grid-template-columns: 1fr; }
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .dealer-list { grid-template-columns: 1fr; }
  }

  @media (max-width: 620px) {
    .app-shell { padding: 14px; }
