"""Bundled SIMULATED fixtures for M4 Demo. No network code lives here (SR-06)."""
SCENARIOS = {
    "DS-A": {"hostname": "demo-a.example", "findings": [
        {"check": "CHK-01", "status": "present"}, {"check": "CHK-02", "status": "missing"},
        {"check": "CHK-03", "status": "missing"}, {"check": "CHK-04", "status": "missing"},
        {"check": "CHK-05", "status": "present"}, {"check": "CHK-06", "status": "missing"},
        {"check": "CHK-07", "status": "present", "detail": "Server / X-Powered-By"}]},
    "DS-B": {"hostname": "demo-b.example", "findings": [
        {"check": "CHK-01", "status": "present"}, {"check": "CHK-02", "status": "present"},
        {"check": "CHK-03", "status": "present"}, {"check": "CHK-04", "status": "present"},
        {"check": "CHK-05", "status": "missing", "detail": "Permissions-Policy"},
        {"check": "CHK-06", "status": "present"}, {"check": "CHK-07", "status": "missing"}]},
    "DS-C": {"hostname": "demo-c.example", "findings": [
        {"check": "CHK-01", "status": "missing", "detail": "expired"}] + [
        {"check": f"CHK-0{i}", "status": "unknown"} for i in range(2, 8)]},
}
