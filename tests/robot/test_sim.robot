*** Settings ***
Library           NeuroDSPKeywords.py

*** Test Cases ***
Test Sim Combined
    ${components}=    Create Dictionary    sim_oscillation=${{ {'freq': 10} }}    sim_powerlaw=${{ {'exponent': -2} }}
    ${sig}=           Simulate Combined Signal    1    500    ${components}
    Check Signal Output    ${sig}

Test Sim Combined Multiple Oscillations
    ${osc1}=          Create Dictionary    freq=10
    ${osc2}=          Create Dictionary    freq=20
    ${oscs}=          Create List          ${osc1}    ${osc2}
    ${ap}=            Create Dictionary    exponent=-2
    ${components}=    Create Dictionary    sim_oscillation=${oscs}    sim_powerlaw=${ap}
    ${sig}=           Simulate Combined Signal    1    500    ${components}
    Check Signal Output    ${sig}
