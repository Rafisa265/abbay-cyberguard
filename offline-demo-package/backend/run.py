import os
from pathlib import Path
import uvicorn
from app import config

if __name__ == "__main__":
    pid_file = Path(__file__).resolve().parents[1] / "demo_server.pid"
    pid_file.write_text(str(os.getpid()), encoding="utf-8")
    try:
        config.check_bind()
        uvicorn.run("app.main:app", host=config.BIND, port=config.PORT, access_log=False)
    finally:
        if pid_file.exists():
            try:
                pid_file.unlink()
            except Exception:
                pass

