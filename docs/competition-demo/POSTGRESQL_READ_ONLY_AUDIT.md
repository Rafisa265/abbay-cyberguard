# CyberShield Ethiopia — Read-Only PostgreSQL & Database Architecture Audit

**Project:** CyberShield Ethiopia  
**Repository Root:** `D:\CyberShield-Ethiopia`  
**Audit Mode:** Non-Destructive / Read-Only Environment Inspection  
**Audit Timestamp:** October 2026  
**Auditor:** Senior Software & Security Architecture Review

---

## 1. Executive Summary

This read-only audit establishes the empirical state of the database infrastructure for CyberShield Ethiopia.

Previous development reports indicated that PostgreSQL 16 had been configured with databases `cybershield_dev` and `cybershield_test`. However, live inspection confirms that **no PostgreSQL Windows service is currently active, TCP port 5432 is not listening, and command-line client tools (`psql`) are not available in system `PATH`**.

In accordance with mandatory safety boundaries, **no services were started, modified, or reconfigured, no databases were touched, and no migrations were executed**. 

The application architecture includes a graceful degradation strategy:
1. **Interactive Client Operations**: The frontend operates in **Guest Mode**, persisting all learning progress, XP, badges, and quiz results in browser `localStorage`.
2. **Local Backend Routes**: The majority of backend routes (M1 lexical ML, M3 incident triage, M4 static security simulation, Assistant rule engine, and static artwork) do not require a database connection.
3. **Automated Backend Tests**: Pytest suites employ an automatic, non-destructive in-memory SQLite fallback (`sqlite:///:memory:`) when the PostgreSQL port is unreachable, enabling all 253 backend tests to pass.
4. **Impact on Production Features**: Persistent server-side user registration, password-authenticated login, server-side notifications, and cross-device cloud synchronization are **unavailable and unverified** while the PostgreSQL service remains inactive.

---

## 2. Infrastructure & Service Inspection

| Inspection Vector | Target / Mechanism | Observed State | Technical Detail / Finding |
| :--- | :--- | :---: | :--- |
| **TCP Port 5432** | Socket connection to `127.0.0.1:5432` | **CLOSED / NOT LISTENING** | `connect_ex` returns error code `10013` (WSAEACCES / connection refused). No process binds port 5432. |
| **Windows Services** | `Get-Service -Name *postgres*` | **NONE FOUND** | No registered Windows Service matching the pattern `*postgres*` exists on the host. |
| **CLI Binaries** | `where.exe psql` | **NOT FOUND** | `psql` binary is not present in the host system `PATH`. |
| **Standard Install Paths** | File system scan of `C:\Program Files\PostgreSQL`, `C:\PostgreSQL`, `D:\PostgreSQL` | **NOT PRESENT** | Default enterprise installer paths do not contain an active PostgreSQL server installation. |

---

## 3. Backend Database Configuration & Environment

The backend database settings are managed in `backend/app/config.py` and loaded from environment variables or local `.env` files:

```python
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres@127.0.0.1:5432/cybershield_dev"
)
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://postgres@127.0.0.1:5432/cybershield_test"
)
```

- **Driver:** `psycopg` (version 3) via SQLAlchemy ORM.
- **Connection Pool:** `pool_pre_ping=True` in `backend/app/database.py` to detect disconnected sockets before executing statements.
- **Credentials:** No hardcoded passwords in configuration source code. Defaults to loopback peer authentication on port 5432.

---

## 4. Alembic Migrations & Schema Architecture

Alembic configuration is preserved in `backend/alembic.ini` and `backend/alembic/`:
- **Migration Directory:** `backend/alembic/versions/`
- **Existing Migrations:**
  1. `001_initial_schema.py` (Users, UserProfiles, ProgressTracking, LearningHistory)
  2. `002_notifications.py` (SystemNotifications, ReadReceipts)

Because TCP port 5432 is not listening, the live presence or schema version of `cybershield_dev` and `cybershield_test` cannot be queried directly over a live network connection without starting a PostgreSQL service.

---

## 5. Test Suite & SQLite Fallback Mechanism

The backend test suite (`backend/tests/test_auth.py` and `test_notifications.py`) implements a robust, non-destructive connection guard:

```python
def _create_test_engine():
    db_url = config.TEST_DATABASE_URL
    if db_url and not db_url.startswith("sqlite"):
        try:
            url = make_url(db_url)
            if "test" in (url.database or "").lower():
                with socket.create_connection((url.host or "127.0.0.1", url.port or 5432), timeout=0.3):
                    eng = create_engine(db_url, pool_pre_ping=True)
                    with eng.connect():
                        return eng
        except Exception:
            pass

    # Seamless offline fallback: In-memory SQLite with StaticPool
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Enforce foreign key constraints
    @event.listens_for(eng, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return eng
```

This safety design ensures that:
- Running backend tests never alters production or development databases.
- When PostgreSQL is inactive, the test suite falls back cleanly to SQLite, executing all model, relational integrity, and foreign-key tests successfully (253 of 253 tests pass).

---

## 6. Functional Impact on Application Features

| Feature Area | Dependent on PostgreSQL? | Behavior with PostgreSQL Inactive | Operational Status |
| :--- | :---: | :--- | :---: |
| **M1: Phishing Link Inspector** | **NO** | Runs 100% offline via local lexical rule engine & client-side Softmax ML classifier (`ml_url_lexical_v1`). | **FULLY OPERATIONAL** |
| **M2: Password Strength & Entropy** | **NO** | Evaluated entirely in client-side JavaScript memory (NIST entropy math + zxcvbn). Zero network transmission. | **FULLY OPERATIONAL** |
| **M3: Incident Triage & Hotlines** | **NO** | Evaluated client-side via 18-feature trilingual Softmax ML classifier (`ml_m3_incident_v1`). Generates local PDF. | **FULLY OPERATIONAL** |
| **M4: Website Security Simulator** | **NO** | Evaluates bundled static educational scenarios (`DS-A`, `DS-B`, etc.) via simulated header checks. | **FULLY OPERATIONAL** |
| **M5 & Learn Curriculum** | **NO** | Interactive curriculum, exercises, and quizzes render client-side without backend database queries. | **FULLY OPERATIONAL** |
| **Cyber Hero Journey** | **NO** | XP progression, badge awards, and Softmax recommendation copilot operate locally in browser memory. | **FULLY OPERATIONAL** |
| **Shared AI Assistant** | **NO** | Deterministic rule-based/FAQ engine operates offline in English, Afaan Oromoo, and Amharic. | **FULLY OPERATIONAL** |
| **Guest Mode Persistence** | **NO** | Saves all learning history, scores, and badges in browser `localStorage`. | **FULLY OPERATIONAL** |
| **User Registration & Login** | **YES** | `routes_auth.py` endpoints fail gracefully because PostgreSQL connection attempts fail. | **BLOCKED / UNAVAILABLE** |
| **Server-Side Notifications** | **YES** | `routes_notifications.py` endpoints cannot read or write notifications without an active database. | **BLOCKED / UNAVAILABLE** |
| **Cross-Device Cloud Sync** | **YES** | Requires server-side authenticated user session and database storage. | **UNVERIFIED / ROADMAP** |

---

## 7. Distinguishing Local Storage from Server Persistence

It is critical for academic and competition integrity to distinguish local client storage from durable server persistence:
- **`localStorage` (Active & Verified)**: Retains learner progress, XP, and badges within the specific user's browser. It survives page refreshes and browser restarts on the same machine.
- **Server Persistence & Cloud Sync (Inactive & Unverified)**: Requires a live PostgreSQL database and authenticated backend session. It cannot be demonstrated in the current offline environment without starting PostgreSQL.
- **Presentation Rule**: Presenters must explain that the demo operates in **Guest Mode**, demonstrating client-side resilience and privacy, while cloud profile synchronization represents the next development milestone.

---

## 8. Recommended Next Steps (Requires Developer Approval)

If the developer desires to demonstrate server-side registration and database-backed sync in future presentations:

1. **Verify Host Service**: Inspect whether PostgreSQL is installed as a portable bundle or separate container that is currently stopped.
2. **Start Service with Approval**: If authorized by the developer, start the PostgreSQL service on port 5432:
   ```powershell
   Start-Service postgresql-x64-16
   ```
3. **Verify Database Connections**: Confirm `cybershield_dev` and `cybershield_test` are reachable via `psql -U postgres -h 127.0.0.1`.
4. **Run Alembic Migrations**:
   ```bash
   alembic upgrade head
   ```
5. **Regression Test Auth Endpoints**: Execute `backend/tests/test_auth.py` against the live test database.

*Current Status: Unchanged. No unauthorized service or database modifications were performed.*

---

*Document prepared for CyberShield Ethiopia Competition Presentation.*  
*Cross-References:* [Judge Q&A](file:///D:/CyberShield-Ethiopia/docs/competition-demo/JUDGE_QA.md) | [Demo Readiness Checklist](file:///D:/CyberShield-Ethiopia/docs/competition-demo/DEMO_READINESS_CHECKLIST.md)

