import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';

const API_BASE = "http://localhost:8000";

const TabButton = ({ id, active, onClick, label, title }) => (
  <button
    onClick={() => onClick(id)}
    title={title || label}
    className={active === id ? 'neonBtn active' : 'neonBtn'}
    type="button"
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

  const tabDescriptions = {
    sim: {
      label: 'SIM',
      description: 'Simulate time series, including periodic and aperiodic signal components.'
    },
    spectral: {
      label: 'SPECTRAL',
      description: 'Compute freqeuncy domain features such as power spectra.'
    },
    aperiodic: {
      label: 'APERIODIC',
      description: 'Analyze aperiodic features of neural time series (IRASA, Autocorrelation).'
    },
    rhythm: {
      label: 'RHYTHM',
      description: 'Find and analyze rhythmic and recurrent patterns in time series.'
    },
    ml: {
      label: 'ML',
      description: 'Automated feature extraction bridge for Machine Learning pipelines.'
    }
  };

  const activeTabDescription = tabDescriptions[activeTab]?.description || '';

  const tooltipContentStyle = {
    backgroundColor: 'rgba(8, 12, 26, 0.92)',
    border: '1px solid rgba(0, 245, 255, 0.22)',
    borderRadius: 12,
    color: 'rgba(220, 255, 255, 0.95)',
    boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
    backdropFilter: 'blur(8px)'
  };

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
        if (data) {
          const points = data.freqs
            .map((f, i) => ({
              freq: Number(Number(f).toFixed(2)),
              psd: data.psd[i]
            }))
            // log-scale needs strictly positive values
            .filter(p => Number.isFinite(p.freq) && typeof p.psd === 'number' && p.psd > 0);
          setResults(prev => ({ ...prev, spectral: points }));
        }
        break;
      case 'aperiodic':
        data = await fetchData('/analyze/aperiodic', { sig: sigArray, fs });
        if (data) setResults(prev => ({ ...prev, aperiodic: data }));
        break;
      case 'ml':
        data = await fetchData('/features', { sig: sigArray, fs });
        if (data) setResults(prev => ({ ...prev, ml: data }));
        break;
      case 'rhythm':
        data = await fetchData('/analyze/rhythm', { sig: sigArray, fs, freqs: [8, 9, 10, 11, 12] });
        if (data) setResults(prev => ({ ...prev, rhythm: data.freqs.map((f, i) => ({ freq: Number(f), lc: data.lc[i] })) }));
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
    <div className="appRoot">
      <header className="header">
        <div>
          <div className="brandTitle">
            NeuroDSP Dashboard{' '}
            <span style={{ fontWeight: 'lighter', fontSize: '0.95rem', color: 'var(--muted)' }}>v2.0</span>
          </div>
          <div className="brandSub">Cyberpunk analytics console • RWD Ready</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {Object.keys(results).length > 0 && (
            <button className="neonAction" onClick={exportResults} type="button">
              Export Analysis (.json)
            </button>
          )}

          <div className="statusPill" aria-live="polite">
            <span className={loading ? 'statusDot loading' : 'statusDot'} />
            {loading ? 'Processing...' : hasSignal ? 'Signal Loaded' : 'Ready'}
          </div>
        </div>
      </header>

      <div className="layoutGrid">
        <section className="card">
          <div className="tabs">
            {['sim', 'spectral', 'aperiodic', 'rhythm', 'ml'].map(t => (
              <TabButton
                key={t}
                id={t}
                active={activeTab}
                onClick={setActiveTab}
                label={t.toUpperCase()}
                title={tabDescriptions[t]?.description}
              />
            ))}
          </div>

          {activeTabDescription ? (
            <div className="tabDescription">
              <strong>{activeTab.toUpperCase()}:</strong> {activeTabDescription}
            </div>
          ) : null}

          <div className="panel">
            {activeTab === 'sim' && (
              <div className="row">
                <button className="neonAction" onClick={() => handleAction('sim_combined')} disabled={loading} type="button">
                  Simulate Combined (1/f + 10Hz)
                </button>
                <button className="neonAction" onClick={() => handleAction('load_real')} disabled={loading} type="button">
                  Load Sample LFP
                </button>
              </div>
            )}

            {activeTab === 'spectral' && (
              <div>
                <div className="row">
                  <button className="neonAction" onClick={() => handleAction('spectral')} disabled={loading || !hasSignal} type="button">
                    Compute Welch PSD
                  </button>
                </div>
                {results.spectral && results.spectral.length > 0 && (
                  <div className="chartMiniWrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={results.spectral}>
                        <CartesianGrid stroke="rgba(0,245,255,0.14)" strokeDasharray="4 4" vertical={false} />
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
                          tickFormatter={(v) => (typeof v === 'number' ? v.toExponential(1) : String(v))}
                          axisLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                          tickLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                        />
                        <Tooltip contentStyle={tooltipContentStyle} />
                        <Line type="monotone" dataKey="psd" stroke="#00f5ff" dot={false} strokeWidth={2} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {results.spectral && results.spectral.length === 0 ? <div className="miniText">No positive PSD points to draw (log scale).</div> : null}
              </div>
            )}

            {activeTab === 'aperiodic' && (
              <div>
                <div className="row">
                  <button className="neonAction" onClick={() => handleAction('aperiodic')} disabled={loading || !hasSignal} type="button">
                    Separate Periodic/Aperiodic
                  </button>
                </div>
                {results.aperiodic && (
                  <div className="chartMiniWrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={results.aperiodic.irasa.freqs.map((f, i) => {
                          const freq = Number(f);
                          const apVal = results.aperiodic.irasa.aperiodic[i];
                          const peVal = results.aperiodic.irasa.periodic[i];
                          return {
                            freq,
                            ap: typeof apVal === 'number' && apVal > 0 ? apVal : null,
                            pe: typeof peVal === 'number' && peVal > 0 ? peVal : null
                          };
                        })}
                      >
                        <CartesianGrid stroke="rgba(0,245,255,0.14)" strokeDasharray="4 4" vertical={false} />
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
                        <Line type="monotone" dataKey="ap" stroke="#6610f2" dot={false} name="Aperiodic Component" strokeWidth={2} isAnimationActive={false} />
                        <Line type="monotone" dataKey="pe" stroke="#ff3df2" dot={false} name="Periodic Component" strokeWidth={2} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'rhythm' && (
              <div>
                <div className="row">
                  <button className="neonAction" onClick={() => handleAction('rhythm')} disabled={loading || !hasSignal} type="button">
                    Compute Lagged Coherence
                  </button>
                </div>
                {results.rhythm && results.rhythm.length > 0 && (
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
                        <YAxis
                          domain={[0, 1]}
                          tick={{ fill: 'rgba(220, 255, 255, 0.78)' }}
                          axisLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                          tickLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                        />
                        <Tooltip contentStyle={tooltipContentStyle} />
                        <Line type="step" dataKey="lc" stroke="#ff7a18" strokeWidth={3} isAnimationActive={false} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ml' && (
              <div>
                <div className="row">
                  <button className="neonAction" onClick={() => handleAction('ml')} disabled={loading || !hasSignal} type="button">
                    Extract Feature Suite
                  </button>
                </div>
                {results.ml && (
                  <pre className="jsonPre">{JSON.stringify(results.ml, null, 2)}</pre>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="card chartCard">
          <h3 className="cardTitle">Signal Visualization</h3>
          <div className="chartWrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={signal}>
                <CartesianGrid stroke="rgba(0,245,255,0.14)" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="x"
                  tick={{ fill: 'rgba(220, 255, 255, 0.78)' }}
                  axisLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                  tickLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                  tickFormatter={(v) => `${Number(v).toFixed(1)}s`}
                  hide={!hasSignal}
                />
                <YAxis
                  tick={{ fill: 'rgba(220, 255, 255, 0.78)' }}
                  axisLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                  tickLine={{ stroke: 'rgba(0,245,255,0.20)' }}
                />
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  labelFormatter={(v) => `${Number(v).toFixed(3)}s`}
                />
                <Line type="monotone" dataKey="y" stroke="#39ff88" dot={false} isAnimationActive={false} strokeWidth={2} />
                <Brush dataKey="x" height={30} stroke="#00f5ff" tickFormatter={(v) => Number(v).toFixed(1)} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
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
