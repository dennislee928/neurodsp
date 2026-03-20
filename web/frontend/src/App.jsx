import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const API_BASE = "http://localhost:8000";

function App() {
  const [signal, setSignal] = useState([]);
  const [, setFiltered] = useState([]);
  const [fs, setFs] = useState(500);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('sim');

  const fetchData = async (endpoint, body) => {
    setLoading(true);
    setErrorMsg('');
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
      setErrorMsg(e?.message || 'Unexpected API error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const tooltipContentStyle = {
    backgroundColor: 'rgba(8, 12, 26, 0.92)',
    border: '1px solid rgba(0, 245, 255, 0.22)',
    borderRadius: 12,
    color: 'rgba(220, 255, 255, 0.95)',
    boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
    backdropFilter: 'blur(8px)'
  };

  const tabs = ['sim', 'spectral', 'aperiodic', 'burst', 'rhythm', 'ml', 'advanced'];

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
          <div className="row">
            <button className="neonAction" onClick={handleSimulate} disabled={loading}>Simulate Combined</button>
            <button className="neonAction" onClick={handleLoadReal} disabled={loading}>Load Real Signal</button>
          </div>
        );
      case 'spectral':
        return (
          <div>
            <div className="row">
              <button className="neonAction" onClick={() => runAnalysis('spectral')} disabled={loading || signal.length === 0}>Compute Spectrum</button>
            </div>
            {results.spectral && (
              <div className="chartMiniWrap">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results.spectral}>
                    <CartesianGrid stroke="rgba(0,245,255,0.14)" strokeDasharray="4 4" />
                    <XAxis
                      dataKey="freq"
                      label="Freq (Hz)"
                      tick={{ fill: 'rgba(220, 255, 255, 0.78)' }}
                      axisLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                      tickLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                    />
                    <YAxis
                      scale="log"
                      domain={['auto', 'auto']}
                      label="Power"
                      tick={{ fill: 'rgba(220, 255, 255, 0.78)' }}
                      axisLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                      tickLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                    />
                    <Tooltip contentStyle={tooltipContentStyle} />
                    <Line type="monotone" dataKey="psd" stroke="#00f5ff" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      case 'aperiodic':
        return (
          <div>
            <div className="row">
              <button className="neonAction" onClick={() => runAnalysis('aperiodic')} disabled={loading || signal.length === 0}>Run IRASA</button>
            </div>
            {results.aperiodic && (
               <div className="chartMiniWrap">
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={results.aperiodic.irasa.freqs.map((f, i) => ({
                     freq: f,
                     ap: results.aperiodic.irasa.aperiodic[i],
                     pe: results.aperiodic.irasa.periodic[i]
                   }))}>
                     <CartesianGrid stroke="rgba(0,245,255,0.14)" strokeDasharray="4 4" />
                     <XAxis
                       dataKey="freq"
                       tick={{ fill: 'rgba(220, 255, 255, 0.78)' }}
                       axisLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                       tickLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                     />
                     <YAxis
                       scale="log"
                       domain={['auto', 'auto']}
                       tick={{ fill: 'rgba(220, 255, 255, 0.78)' }}
                       axisLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                       tickLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                     />
                     <Tooltip contentStyle={tooltipContentStyle} />
                     <Legend wrapperStyle={{ color: 'rgba(220,255,255,0.85)' }} />
                     <Line type="monotone" dataKey="ap" stroke="#00f5ff" dot={false} name="Aperiodic" isAnimationActive={false} />
                     <Line type="monotone" dataKey="pe" stroke="#39ff88" dot={false} name="Periodic" isAnimationActive={false} />
                   </LineChart>
                 </ResponsiveContainer>
               </div>
            )}
          </div>
        );
      case 'burst':
        return (
            <div>
              <div className="row">
                <button className="neonAction" onClick={() => runAnalysis('burst')} disabled={loading || signal.length === 0}>Detect Bursts (10Hz)</button>
              </div>
              {results.burst && (
                <p className="miniText">Burst detected in {results.burst.filter(b => b).length} samples.</p>
              )}
            </div>
        );
      case 'rhythm':
        return (
            <div>
                <div className="row">
                  <button className="neonAction" onClick={() => runAnalysis('rhythm')} disabled={loading || signal.length === 0}>Lagged Coherence</button>
                </div>
                {results.rhythm && (
                    <div className="chartMiniWrap">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={results.rhythm}>
                                <CartesianGrid stroke="rgba(0,245,255,0.14)" strokeDasharray="4 4" />
                                <XAxis
                                  dataKey="freq"
                                  tick={{ fill: 'rgba(220, 255, 255, 0.78)' }}
                                  axisLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                                  tickLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                                />
                                <YAxis tick={{ fill: 'rgba(220, 255, 255, 0.78)' }} axisLine={{ stroke: 'rgba(0,245,255,0.20)' }} tickLine={{ stroke: 'rgba(0,245,255,0.20)' }} />
                                <Tooltip contentStyle={tooltipContentStyle} />
                                <Line type="monotone" dataKey="lc" stroke="#ff7a18" dot={false} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        );
      case 'ml':
        return (
            <div>
                <div className="row">
                  <button className="neonAction" onClick={() => runAnalysis('features')} disabled={loading || signal.length === 0}>Extract All Features</button>
                </div>
                {results.features && (
                  <pre className="jsonPre">{JSON.stringify(results.features, null, 2)}</pre>
                )}
            </div>
        );
      case 'advanced':
        return (
            <div>
              <div className="row">
                <button className="neonAction" onClick={() => runAnalysis('nonlinear')} disabled={loading || signal.length === 0}>Sample Entropy</button>
                <button className="neonAction" onClick={() => runAnalysis('connectivity')} disabled={loading || signal.length === 0}>PLV (Signal vs Noise)</button>
              </div>
              {results.nonlinear && (
                <p className="miniText">Sample Entropy: {results.nonlinear.sample_entropy.toFixed(4)}</p>
              )}
              {results.connectivity && (
                <p className="miniText">Connectivity Matrix (PLV): {JSON.stringify(results.connectivity.plv)}</p>
              )}
            </div>
        )
    }
  };

  return (
    <div className="appRoot">
      <header className="header">
        <div>
          <div className="brandTitle">NeuroDSP Dashboard Pro</div>
          <div className="brandSub">Cyberpunk analytics console • RWD Ready</div>
        </div>
        <div className="statusPill">
          <span className={loading ? 'statusDot loading' : 'statusDot'} />
          {loading ? 'Processing...' : 'Ready'}
        </div>
      </header>

      {errorMsg ? <div className="errorBar" role="alert">{errorMsg}</div> : null}

      <div className="layoutGrid">
        <section className="card">
          <div className="tabs">
            {tabs.map(t => (
              <button
                key={t}
                className={activeTab === t ? 'neonBtn active' : 'neonBtn'}
                onClick={() => setActiveTab(t)}
                type="button"
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="panel">{renderTabContent()}</div>
        </section>

        <section className="card chartCard">
          <h3 className="cardTitle">Signal Visualization</h3>
          <div className="chartWrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={signal}>
                <CartesianGrid stroke="rgba(0,245,255,0.14)" strokeDasharray="4 4" />
                <XAxis
                  dataKey="x"
                  tick={{ fill: 'rgba(220, 255, 255, 0.78)' }}
                  axisLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                  tickLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                />
                <YAxis
                  tick={{ fill: 'rgba(220, 255, 255, 0.78)' }}
                  axisLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                  tickLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                />
                <Tooltip contentStyle={tooltipContentStyle} />
                <Line type="monotone" dataKey="y" stroke="#39ff88" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
