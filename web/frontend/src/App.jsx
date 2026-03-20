import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';

const API_BASE = "http://localhost:8000";

const TabButton = ({ id, active, onClick, label }) => (
  <button 
    onClick={() => onClick(id)}
    style={{
      padding: '10px 20px',
      cursor: 'pointer',
      backgroundColor: active === id ? '#007bff' : '#f8f9fa',
      color: active === id ? 'white' : '#333',
      border: '1px solid #dee2e6',
      borderBottom: 'none',
      borderRadius: '5px 5px 0 0',
      marginRight: '5px',
      fontWeight: 'bold',
      transition: 'all 0.2s'
    }}
  >
    {label}
  </button>
);

const ControlGroup = ({ title, children }) => (
  <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f1f3f5', borderRadius: '5px' }}>
    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#495057' }}>{title}</h4>
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>{children}</div>
  </div>
);

function App() {
  const [signal, setSignal] = useState([]);
  const [fs, setFs] = useState(500);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('sim');

  const hasSignal = signal.length > 0;

  const fetchData = async (endpoint, body) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'API Error');
      return data;
    } catch (e) {
      alert(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (type) => {
    let data;
    const sigArray = signal.map(d => d.y);

    switch(type) {
      case 'sim_combined':
        data = await fetchData('/simulate', { n_seconds: 4, fs: 500, components: { sim_powerlaw: { exponent: -1.5 }, sim_oscillation: { freq: 10 } } });
        if (data) { setSignal(data.sig.map((v, i) => ({ x: i / data.fs, y: v }))); setFs(data.fs); }
        break;
      case 'load_real':
        const res = await fetch(`${API_BASE}/load-real`);
        data = await res.json();
        if (data.sig) { setSignal(data.sig.map((v, i) => ({ x: i / data.fs, y: v }))); setFs(data.fs); }
        break;
      case 'spectral':
        data = await fetchData('/analyze/spectral', { sig: sigArray, fs });
        if (data) setResults({ ...results, spectral: data.freqs.map((f, i) => ({ freq: f.toFixed(2), psd: data.psd[i] })) });
        break;
      case 'aperiodic':
        data = await fetchData('/analyze/aperiodic', { sig: sigArray, fs });
        if (data) setResults({ ...results, aperiodic: data });
        break;
      case 'ml':
        data = await fetchData('/features', { sig: sigArray, fs });
        if (data) setResults({ ...results, ml: data });
        break;
      case 'rhythm':
        data = await fetchData('/analyze/rhythm', { sig: sigArray, fs, freqs: [8, 9, 10, 11, 12] });
        if (data) setResults({ ...results, rhythm: data.freqs.map((f, i) => ({ freq: f, lc: data.lc[i] })) });
        break;
    }
  };

  const exportResults = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'neurodsp_results.json';
    a.click();
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', color: '#212529' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ margin: 0, color: '#007bff' }}>NeuroDSP Dashboard <span style={{ fontWeight: 'lighter', fontSize: '1rem', color: '#6c757d' }}>v2.0</span></h1>
        {Object.keys(results).length > 0 && <button onClick={exportResults} style={{ padding: '8px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Export Analysis (.json)</button>}
      </header>

      <div style={{ display: 'flex', marginBottom: '-1px' }}>
        {['sim', 'spectral', 'aperiodic', 'rhythm', 'ml'].map(t => (
          <TabButton key={t} id={t} active={activeTab} onClick={setActiveTab} label={t.toUpperCase()} />
        ))}
      </div>

      <div style={{ border: '1px solid #dee2e6', padding: '20px', borderRadius: '0 5px 5px 5px', backgroundColor: 'white', marginBottom: '30px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        {activeTab === 'sim' && (
          <ControlGroup title="Data Source">
            <button onClick={() => handleAction('sim_combined')} disabled={loading}>Simulate Combined (1/f + 10Hz)</button>
            <button onClick={() => handleAction('load_real')} disabled={loading}>Load Sample LFP</button>
          </ControlGroup>
        )}

        {activeTab === 'spectral' && (
          <ControlGroup title="Power Spectrum">
            <button onClick={() => handleAction('spectral')} disabled={loading || !hasSignal}>Compute Welch PSD</button>
            {results.spectral && (
              <div style={{ height: 350, marginTop: '20px' }}>
                <ResponsiveContainer>
                  <LineChart data={results.spectral}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="freq" />
                    <YAxis scale="log" domain={['auto', 'auto']} tickFormatter={(v) => v.toExponential(1)} />
                    <Tooltip />
                    <Line type="monotone" dataKey="psd" stroke="#007bff" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ControlGroup>
        )}

        {activeTab === 'aperiodic' && (
          <ControlGroup title="IRASA Decomposition">
            <button onClick={() => handleAction('aperiodic')} disabled={loading || !hasSignal}>Separate Periodic/Aperiodic</button>
            {results.aperiodic && (
              <div style={{ height: 350, marginTop: '20px' }}>
                <ResponsiveContainer>
                  <LineChart data={results.aperiodic.irasa.freqs.map((f, i) => ({
                    freq: f.toFixed(1),
                    ap: results.aperiodic.irasa.aperiodic[i],
                    pe: results.aperiodic.irasa.periodic[i]
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="freq" />
                    <YAxis scale="log" domain={['auto', 'auto']} />
                    <Tooltip />
                    <Legend verticalAlign="top" height={36}/>
                    <Line type="monotone" dataKey="ap" stroke="#6610f2" dot={false} name="Aperiodic Component" strokeWidth={2} />
                    <Line type="monotone" dataKey="pe" stroke="#e83e8c" dot={false} name="Periodic Component" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ControlGroup>
        )}

        {activeTab === 'rhythm' && (
          <ControlGroup title="Rhythmicity">
            <button onClick={() => handleAction('rhythm')} disabled={loading || !hasSignal}>Compute Lagged Coherence</button>
            {results.rhythm && (
              <div style={{ height: 300, marginTop: '20px' }}>
                <ResponsiveContainer>
                  <LineChart data={results.rhythm}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="freq" />
                    <YAxis domain={[0, 1]} />
                    <Tooltip />
                    <Line type="step" dataKey="lc" stroke="#fd7e14" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ControlGroup>
        )}

        {activeTab === 'ml' && (
          <ControlGroup title="ML Feature Extraction">
            <button onClick={() => handleAction('ml')} disabled={loading || !hasSignal}>Extract Feature Suite</button>
            {results.ml && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginTop: '20px' }}>
                {Object.entries(results.ml).map(([k, v]) => (
                  <div key={k} style={{ padding: '10px', border: '1px solid #eee', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6c757d', textTransform: 'uppercase' }}>{k.replace('_', ' ')}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{typeof v === 'number' ? v.toFixed(4) : String(v)}</div>
                  </div>
                ))}
              </div>
            )}
          </ControlGroup>
        )}
      </div>

      <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '5px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #dee2e6' }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', display: 'flex', justifyContent: 'space-between' }}>
          Signal Preview {hasSignal && <span style={{ color: '#6c757d', fontWeight: 'normal' }}>{signal.length} samples @ {fs}Hz</span>}
        </h3>
        <div style={{ height: '250px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={signal}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="x" tickFormatter={(v) => v.toFixed(1) + 's'} hide={!hasSignal} />
              <YAxis />
              <Tooltip labelFormatter={(v) => v.toFixed(3) + 's'} />
              <Line type="monotone" dataKey="y" stroke="#343a40" dot={false} isAnimationActive={false} strokeWidth={1} />
              <Brush dataKey="x" height={30} stroke="#007bff" tickFormatter={(v) => v.toFixed(1)} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontWeight: 'bold', color: '#007bff' }}>Processing Analysis...</div>
        </div>
      )}
    </div>
  );
}

export default App;
