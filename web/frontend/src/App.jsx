import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, Cell } from 'recharts';

const API_BASE = "http://localhost:8000";

function App() {
  const [signal, setSignal] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [fs, setFs] = useState(500);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('sim');

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

  const handleSimulate = async () => {
    const data = await fetchData('/simulate', {
      n_seconds: 4,
      fs: 500,
      components: {
        sim_powerlaw: { exponent: -1.5 },
        sim_oscillation: { freq: 10 }
      }
    });
    if (data) {
      setSignal(data.sig.map((v, i) => ({ x: i / data.fs, y: v })));
      setFs(data.fs);
      setFiltered([]);
    }
  };

  const handleLoadReal = async () => {
    setLoading(true);
    const res = await fetch(`${API_BASE}/load-real`);
    const data = await res.json();
    if (data.sig) {
      setSignal(data.sig.map((v, i) => ({ x: i / data.fs, y: v })));
      setFs(data.fs);
      setFiltered([]);
    }
    setLoading(false);
  };

  const runAnalysis = async (type) => {
    if (signal.length === 0) return;
    const sigArray = signal.map(d => d.y);
    let data;

    switch(type) {
      case 'spectral':
        data = await fetchData('/analyze/spectral', { sig: sigArray, fs });
        if (data) setResults({ ...results, spectral: data.freqs.map((f, i) => ({ freq: f, psd: data.psd[i] })) });
        break;
      case 'aperiodic':
        data = await fetchData('/analyze/aperiodic', { sig: sigArray, fs });
        if (data) setResults({ ...results, aperiodic: data });
        break;
      case 'burst':
        data = await fetchData('/analyze/burst', { sig: sigArray, fs, dual_thresh: [1, 2], f_range: [8, 12] });
        if (data) setResults({ ...results, burst: data.is_burst });
        break;
      case 'rhythm':
        data = await fetchData('/analyze/rhythm', { sig: sigArray, fs, freqs: [8, 9, 10, 11, 12] });
        if (data) setResults({ ...results, rhythm: data.freqs.map((f, i) => ({ freq: f, lc: data.lc[i] })) });
        break;
      case 'nonlinear':
        data = await fetchData('/analyze/nonlinear', { sig: sigArray, fs });
        if (data) setResults({ ...results, nonlinear: data });
        break;
      case 'features':
        data = await fetchData('/features', { sig: sigArray, fs });
        if (data) setResults({ ...results, features: data });
        break;
      case 'connectivity':
        // Simulate two signals for connectivity
        data = await fetchData('/analyze/connectivity', { 
            sigs: [sigArray, sigArray.map(v => v + Math.random() * 0.5)], 
            fs, 
            f_range: [8, 12] 
        });
        if (data) setResults({ ...results, connectivity: data });
        break;
    }
  };

  const renderTabContent = () => {
    switch(activeTab) {
      case 'sim':
        return (
          <div>
            <button onClick={handleSimulate} disabled={loading}>Simulate Combined</button>
            <button onClick={handleLoadReal} disabled={loading}>Load Real Signal</button>
          </div>
        );
      case 'spectral':
        return (
          <div>
            <button onClick={() => runAnalysis('spectral')} disabled={loading || signal.length === 0}>Compute Spectrum</button>
            {results.spectral && (
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results.spectral}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="freq" label="Freq (Hz)" />
                    <YAxis scale="log" domain={['auto', 'auto']} label="Power" />
                    <Tooltip />
                    <Line type="monotone" dataKey="psd" stroke="#8884d8" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      case 'aperiodic':
        return (
          <div>
            <button onClick={() => runAnalysis('aperiodic')} disabled={loading || signal.length === 0}>Run IRASA</button>
            {results.aperiodic && (
               <div style={{ height: 300 }}>
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={results.aperiodic.irasa.freqs.map((f, i) => ({
                     freq: f,
                     ap: results.aperiodic.irasa.aperiodic[i],
                     pe: results.aperiodic.irasa.periodic[i]
                   }))}>
                     <CartesianGrid strokeDasharray="3 3" />
                     <XAxis dataKey="freq" />
                     <YAxis scale="log" domain={['auto', 'auto']} />
                     <Tooltip />
                     <Legend />
                     <Line type="monotone" dataKey="ap" stroke="#8884d8" dot={false} name="Aperiodic" />
                     <Line type="monotone" dataKey="pe" stroke="#82ca9d" dot={false} name="Periodic" />
                   </LineChart>
                 </ResponsiveContainer>
               </div>
            )}
          </div>
        );
      case 'burst':
        return (
            <div>
                <button onClick={() => runAnalysis('burst')} disabled={loading || signal.length === 0}>Detect Bursts (10Hz)</button>
                {results.burst && <p>Burst detected in {results.burst.filter(b => b).length} samples.</p>}
            </div>
        );
      case 'rhythm':
        return (
            <div>
                <button onClick={() => runAnalysis('rhythm')} disabled={loading || signal.length === 0}>Lagged Coherence</button>
                {results.rhythm && (
                    <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={results.rhythm}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="freq" />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="lc" stroke="#ff7300" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        );
      case 'ml':
        return (
            <div>
                <button onClick={() => runAnalysis('features')} disabled={loading || signal.length === 0}>Extract All Features</button>
                {results.features && <pre style={{background: '#eee', padding: 10}}>{JSON.stringify(results.features, null, 2)}</pre>}
            </div>
        );
      case 'advanced':
        return (
            <div>
                <button onClick={() => runAnalysis('nonlinear')} disabled={loading || signal.length === 0}>Sample Entropy</button>
                <button onClick={() => runAnalysis('connectivity')} disabled={loading || signal.length === 0}>PLV (Signal vs Noise)</button>
                {results.nonlinear && <p>Sample Entropy: {results.nonlinear.sample_entropy.toFixed(4)}</p>}
                {results.connectivity && <p>Connectivity Matrix (PLV): {JSON.stringify(results.connectivity.plv)}</p>}
            </div>
        )
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>NeuroDSP Dashboard Pro</h1>
      
      <div style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            {['sim', 'spectral', 'aperiodic', 'burst', 'rhythm', 'ml', 'advanced'].map(t => (
                <button key={t} onClick={() => setActiveTab(t)} style={{ fontWeight: activeTab === t ? 'bold' : 'normal' }}>
                    {t.toUpperCase()}
                </button>
            ))}
        </div>
        {renderTabContent()}
      </div>

      <div style={{ height: '300px', marginBottom: '40px' }}>
        <h3>Signal Visualization</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={signal}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="y" stroke="#333" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default App;
