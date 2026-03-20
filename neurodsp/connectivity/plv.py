import jax.numpy as jnp
from jax import jit, vmap
from neurodsp.utils.decorators import multidim

@jit
def _calculate_plv(phase1, phase2):
    """JAX implementation of Phase Locking Value (PLV)."""
    return jnp.abs(jnp.mean(jnp.exp(1j * (phase1 - phase2))))

@vmap
def _calculate_plv_pairwise(phase1, phase_all):
    """Vmap for pairwise PLV calculation across all-to-all channels."""
    return vmap(lambda p2: _calculate_plv(phase1, p2))(phase_all)

@multidim(pass_2d_input=True)
def compute_plv_jax(phases):
    """
    Compute all-to-all Phase Locking Value (PLV) using JAX.

    Parameters
    ----------
    phases : 2D array
        Instantaneous phases of multiple channels, shape (n_channels, n_samples).

    Returns
    -------
    plv_matrix : 2D array
        Matrix of PLV values between all channel pairs, shape (n_channels, n_channels).
    """
    # Convert phases to JAX array if needed
    phases_j = jnp.array(phases)
    
    # Vectorized all-to-all PLV computation
    plv_matrix = _calculate_plv_pairwise(phases_j, phases_j)
    
    return plv_matrix
