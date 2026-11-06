import logging
import os
from pathlib import Path
from typing import Generator
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from . import config

log = logging.getLogger("cybershield.db")

Base = declarative_base()


def _build_engine():
    db_url = config.DATABASE_URL
    # Check if a non-SQLite PostgreSQL URL is specified
    if db_url and not db_url.startswith("sqlite"):
        try:
            db_timeout = int(os.getenv("DATABASE_CONNECT_TIMEOUT", "10"))
            eng = create_engine(
                db_url,
                pool_pre_ping=True,
                future=True,
                connect_args={"connect_timeout": db_timeout},
            )
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            log.info("event=db_engine provider=postgresql outcome=connected")
            return eng
        except Exception as e:
            if config.IS_PRODUCTION or not config.ALLOW_SQLITE_FALLBACK:
                log.critical(
                    "event=db_engine provider=postgresql outcome=fatal_startup_failure error=%s",
                    str(e),
                )
                raise RuntimeError(
                    f"Production database connection to PostgreSQL failed: {e}. "
                    "Automatic SQLite fallback is strictly prohibited in production mode. "
                    "Verify PostgreSQL service availability and DATABASE_URL."
                ) from e
            log.warning(
                "event=db_engine provider=postgresql outcome=fallback_to_sqlite reason=%s",
                str(e),
            )

    # SQLite is prohibited in production mode or when fallback is disabled
    if config.IS_PRODUCTION or not config.ALLOW_SQLITE_FALLBACK:
        raise RuntimeError(
            "SQLite database is strictly prohibited in production mode. "
            "A valid, accessible PostgreSQL DATABASE_URL must be provided."
        )

    # Local development offline-first persistent SQLite engine
    sqlite_path = Path(__file__).resolve().parent / "data" / "cybershield_local.db"
    sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    sqlite_url = f"sqlite:///{sqlite_path.as_posix()}"

    eng = create_engine(
        sqlite_url,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
        future=True,
    )

    @event.listens_for(eng, "connect")
    def _configure_sqlite_connection(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

    log.info("event=db_engine provider=sqlite outcome=connected path=%s", sqlite_path)
    return eng


engine = _build_engine()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
    future=True,
)


def init_db():
    """Ensure all required database tables exist."""
    try:
        from . import models  # noqa
        Base.metadata.create_all(bind=engine)
        log.info("event=db_init outcome=tables_created_or_verified")
    except Exception as exc:
        log.error("event=db_init outcome=failed error=%s", str(exc))


def get_db() -> Generator[Session, None, None]:
    """Dependency that provides an isolated SQLAlchemy session per request."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def check_database_health() -> bool:
    """Safe check of database availability without leaking details on failure."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        log.error("event=db_health_check outcome=failed")
        return False
