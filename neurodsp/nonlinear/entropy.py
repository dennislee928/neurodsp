import numpy as np
from neurodsp.utils.decorators import multidim

@multidim()
def sample_entropy(sig, m=2, r=0.2):
    """
    Calculate Sample Entropy of a signal.

    Parameters
    ----------
    sig : 1D array
        Time series signal.
    m : int, optional, default: 2
        Length of compared run of data.
    r : float, optional, default: 0.2
        Filtering level (multiplier of std).

    Returns
    -------
    sampen : float
        The sample entropy of the signal.
    """
    n = len(sig)
    r = r * np.std(sig)
    
    def _phi(m):
        x = np.array([sig[i:i + m] for i in range(n - m + 1)])
        # Use vectorized approach for counting matches
        # Note: This can be memory intensive for very large signals
        # For production, we might use a more memory-efficient loop or JAX
        diff = np.abs(x[:, None, :] - x[None, :, :]).max(axis=2)
        count = (diff <= r).sum() - len(x)  # Subtract self-comparison
        return count / (len(x) * (len(x) - 1))

    phi_m = _phi(m)
    phi_m_plus_1 = _phi(m + 1)
    
    if phi_m == 0 or phi_m_plus_1 == 0:
        return -np.inf
        
    return -np.log(phi_m_plus_1 / phi_m)
