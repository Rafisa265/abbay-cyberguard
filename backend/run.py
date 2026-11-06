import uvicorn
from app import config

if __name__ == "__main__":
    config.check_bind()
    uvicorn.run("app.main:app", host=config.BIND, port=config.PORT, access_log=False)
