from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
import numpy as np
import traceback
import os

from neurodsp.sim import sim_combined
from neurodsp.filt import filter_signal
from neurodsp.ml.bridge import MLFeatureBridge
from neurodsp.aperiodic import compute_irasa, compute_autocorr
from neurodsp.burst import detect_bursts_dual_threshold
from neurodsp.connectivity import compute_plv_jax
from neurodsp.nonlinear import sample_entropy
from neurodsp.rhythm import compute_lagged_coherence
from neurodsp.spectral import compute_spectrum
from neurodsp.timefrequency import amp_by_time, phase_by_time

app = FastAPI(title="NeuroDSP Web API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def to_serializable(v):
    if v is None:
        return None
    if isinstance(v, (np.floating, float)):
        if np.isnan(v) or np.isinf(v):
            return None
        return float(v)
    if isinstance(v, (np.integer, int)):
        return int(v)
    if isinstance(v, np.ndarray):
        return [to_serializable(x) for x in v.tolist()]
    if isinstance(v, list):
        return [to_serializable(x) for x in v]
    if isinstance(v, dict):
        return {str(k): to_serializable(val) for k, val in v.items()}
    if hasattr(v, 'item') and hasattr(v, 'dtype'):
        return to_serializable(v.item())
    return v

# Models
class SignalInput(BaseModel):
    sig: List[float]
    fs: float

class SimParams(BaseModel):
    n_seconds: float = 1.0
    fs: float = 500.0
    components: Dict[str, Dict] = {"sim_powerlaw": {"exponent": -1}}

class FilterParams(BaseModel):
    sig: List[float]
    fs: float
    pass_type: str
    f_range: Union[List[float], float]
    filter_type: str = "fir"
    causal: bool = False

# Endpoints
@app.get("/load-real")
def load_real_signal():
    try:
        data_path = os.path.join(os.path.dirname(__file__), "../../data/sample_data_1.npy")
        sig = np.load(data_path)
        return JSONResponse(content={"sig": to_serializable(sig), "fs": 500.0})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/simulate")
def simulate(params: SimParams):
    try:
        sig = sim_combined(n_seconds=params.n_seconds, fs=params.fs, components=params.components)
        return JSONResponse(content={"sig": to_serializable(sig), "fs": params.fs})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/analyze/spectral")
def analyze_spectral(data: SignalInput):
    try:
        freqs, psd = compute_spectrum(np.array(data.sig), data.fs)
        return JSONResponse(content={"freqs": to_serializable(freqs), "psd": to_serializable(psd)})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/analyze/aperiodic")
def analyze_aperiodic(data: SignalInput):
    try:
        freqs, psd_ap, psd_pe = compute_irasa(np.array(data.sig), data.fs)
        autocorr = compute_autocorr(np.array(data.sig))
        return JSONResponse(content={
            "irasa": {"freqs": to_serializable(freqs), "aperiodic": to_serializable(psd_ap), "periodic": to_serializable(psd_pe)},
            "autocorr": to_serializable(autocorr)
        })
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/analyze/burst")
def analyze_burst(data: SignalInput, dual_thresh: List[float], f_range: List[float]):
    try:
        is_burst = detect_bursts_dual_threshold(np.array(data.sig), data.fs, dual_thresh, f_range)
        return JSONResponse(content={"is_burst": to_serializable(is_burst)})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/analyze/rhythm")
def analyze_rhythm(data: SignalInput, freqs: List[float]):
    try:
        lc = compute_lagged_coherence(np.array(data.sig), data.fs, freqs)
        return JSONResponse(content={"freqs": to_serializable(freqs), "lc": to_serializable(lc)})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/analyze/connectivity")
def analyze_connectivity(sigs: List[List[float]], fs: float, f_range: List[float]):
    try:
        # Multi-channel connectivity (PLV)
        phases = []
        for sig in sigs:
            p = phase_by_time(np.array(sig), fs, f_range)
            phases.append(p)
        plv_matrix = compute_plv_jax(np.array(phases))
        return JSONResponse(content={"plv": to_serializable(plv_matrix)})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/analyze/nonlinear")
def analyze_nonlinear(data: SignalInput):
    try:
        entropy = sample_entropy(np.array(data.sig))
        return JSONResponse(content={"sample_entropy": to_serializable(entropy)})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/filter")
def filter_sig(params: FilterParams):
    try:
        sig = np.array(params.sig)
        f_range = tuple(params.f_range) if isinstance(params.f_range, list) and len(params.f_range) == 2 else params.f_range
        sig_filt = filter_signal(sig, params.fs, params.pass_type, f_range, 
                                 filter_type=params.filter_type, causal=params.causal)
        return JSONResponse(content={"sig_filt": to_serializable(sig_filt)})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/features")
def extract_features(data: SignalInput):
    try:
        bridge = MLFeatureBridge(data.fs)
        features = bridge.extract_features(np.array(data.sig))
        return JSONResponse(content=to_serializable(features))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
