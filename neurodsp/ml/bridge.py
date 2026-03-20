import numpy as np
import pandas as pd
from neurodsp.spectral import compute_spectrum
from neurodsp.aperiodic import compute_irasa
from neurodsp.nonlinear import sample_entropy

class MLFeatureBridge:
    """
    Automated ML feature bridge for NeuroDSP.
    Extracts a suite of features from signals for ML pipelines.
    """
    
    def __init__(self, fs):
        self.fs = fs

    def extract_features(self, sig):
        """
        Extract features from a single signal.
        
        Returns
        -------
        features : dict
            Dictionary of extracted features.
        """
        features = {}
        
        # 1. Basic statistics
        features['mean'] = np.mean(sig)
        features['std'] = np.std(sig)
        features['kurtosis'] = pd.Series(sig).kurt()
        features['skew'] = pd.Series(sig).skew()
        
        # 2. Spectral features
        freqs, psd = compute_spectrum(sig, self.fs)
        features['total_power'] = np.trapz(psd, freqs)
        
        # 3. Aperiodic features (IRASA)
        try:
            freqs_ap, psd_ap, _ = compute_irasa(sig, self.fs)
            # Simple linear fit in log-log space for exponent
            # Add epsilon to avoid log10(0)
            log_freqs = np.log10(freqs_ap[1:] + 1e-10) 
            log_psd = np.log10(psd_ap[1:] + 1e-10)
            slope, _ = np.polyfit(log_freqs, log_psd, 1)
            features['aperiodic_exponent'] = -slope
        except:
            features['aperiodic_exponent'] = np.nan
            
        # 4. Nonlinear features
        try:
            features['sample_entropy'] = sample_entropy(sig)
        except:
            features['sample_entropy'] = np.nan
            
        return features

    def process_epochs(self, epochs):
        """
        Process multiple epochs (2D array: n_epochs, n_samples).
        
        Returns
        -------
        df_features : pd.DataFrame
            DataFrame where each row is an epoch and columns are features.
        """
        all_features = []
        for epoch in epochs:
            all_features.append(self.extract_features(epoch))
            
        return pd.DataFrame(all_features)
