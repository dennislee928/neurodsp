import jax.numpy as jnp
from neurodsp.sim import sim_combined

class NeuroDSPKeywords:
    """Robot Framework keyword library for NeuroDSP."""

    def simulate_combined_signal(self, n_seconds, fs, components):
        """Keyword to simulate a combined signal."""
        # Convert string representations of dicts if necessary, but Robot usually handles it
        return sim_combined(float(n_seconds), float(fs), components)

    def check_signal_output(self, sig):
        """Keyword to check signal output validity."""
        if not isinstance(sig, jnp.ndarray):
            raise AssertionError(f"Expected jnp.ndarray, got {type(sig)}")
        if jnp.isnan(sig).any():
            raise AssertionError("Signal contains NaNs")
        if jnp.isinf(sig).any():
            raise AssertionError("Signal contains infs")
