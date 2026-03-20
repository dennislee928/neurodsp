from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import numpy as np
from neurodsp.sim import sim_combined
from neurodsp.filt import filter_signal
from neurodsp.ml.bridge import MLFeatureBridge

app = FastAPI(title="NeuroDSP Web API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SignalParams(BaseModel):
    n_seconds: float = 1.0
    fs: float = 500.0
    components: Dict[str, Dict] = {"sim_powerlaw": {"exponent": -1}}

class FilterParams(BaseModel):
    sig: List[float]
    fs: float
    pass_type: str
    f_range: List[float]
    filter_type: str = "fir"
    causal: bool = False

import traceback

@app.post("/simulate")
def simulate_signal(params: SignalParams):
    try:
        sig = sim_combined(n_seconds=params.n_seconds, fs=params.fs, components=params.components)
        return {"sig": sig.tolist(), "fs": params.fs}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/filter")
def filter_sig(params: FilterParams):
    try:
        sig = np.array(params.sig)
        f_range = tuple(params.f_range) if len(params.f_range) == 2 else params.f_range[0]
        sig_filt = filter_signal(sig, params.fs, params.pass_type, f_range, 
                                 filter_type=params.filter_type, causal=params.causal)
        return {"sig_filt": sig_filt.tolist()}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

class FeatureParams(BaseModel):
    sig: List[float]
    fs: float

@app.post("/features")
def extract_features(params: FeatureParams):
    try:
        bridge = MLFeatureBridge(params.fs)
        features = bridge.extract_features(np.array(params.sig))
        # Convert nan to None for JSON
        return {k: (None if (v is None or (isinstance(v, (float, np.floating)) and np.isnan(v))) else (float(v) if isinstance(v, (np.floating, float)) else v)) 
                for k, v in features.items()}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
