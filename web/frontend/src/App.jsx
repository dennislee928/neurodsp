import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_BASE = "http://localhost:8000";

function App() {
  const [signal, setSignal] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(false);

  const simulate = async () => {
    setLoading(true);
    const res = await fetch(`${API_BASE}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        n_seconds: 2,
        fs: 500,
        components: {
          sim_powerlaw: { exponent: -1.5 },
          sim_oscillation: { freq: 10 }
        }
      })
    });
    const data = await res.json();
    const chartData = data.sig.map((v, i) => ({ x: i / data.fs, y: v }));
    setSignal(chartData);
    setLoading(false);
  };

  const applyFilter = async () => {
    if (signal.length === 0) return;
    setLoading(true);
    const res = await fetch(`${API_BASE}/filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sig: signal.map(d => d.y),
        fs: 500,
        pass_type: 'bandpass',
        f_range: [8, 12],
        causal: false
      })
    });
    const data = await res.json();
    const chartData = data.sig_filt.map((v, i) => ({ x: i / 500, y: v }));
    setFiltered(chartData);
    setLoading(false);
  };

  const extract = async () => {
    if (signal.length === 0) return;
    const res = await fetch(`${API_BASE}/features?fs=500`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signal.map(d => d.y))
    });
    const data = await res.json();
    setFeatures(data);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>NeuroDSP Dashboard</h1>
      <div style={{ marginBottom: '20px' }}>
        <button onClick={simulate} disabled={loading}>Simulate Signal</button>
        <button onClick={applyFilter} disabled={loading || signal.length === 0}>Apply 10Hz Bandpass</button>
        <button onClick={extract} disabled={loading || signal.length === 0}>Extract ML Features</button>
      </div>

      <div style={{ height: '400px', marginBottom: '40px' }}>
        <h3>Signal Visualization</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={signal}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" label={{ value: 'Time (s)', position: 'insideBottom', offset: -5 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="y" stroke="#8884d8" dot={false} name="Original" />
            {filtered.length > 0 && <Line type="monotone" dataKey="y" data={filtered} stroke="#82ca9d" dot={false} name="Filtered" />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {Object.keys(features).length > 0 && (
        <div>
          <h3>ML Features</h3>
          <pre>{JSON.stringify(features, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default App;
