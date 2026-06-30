"""Butterfly backend entrypoint."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from db import ensure_indexes, get_client
from storage import init_storage
from routes_auth import router as auth_router
from routes_buddy import router as buddy_router
from routes_entries import router as entries_router
from routes_uploads import router as uploads_router


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("butterfly")


app = FastAPI(title="Butterfly", version="1.0.0")
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"app": "butterfly", "ok": True}


@api_router.get("/health")
async def health():
    return {"status": "ok"}


api_router.include_router(auth_router)
api_router.include_router(buddy_router)
api_router.include_router(entries_router)
api_router.include_router(uploads_router)

app.include_router(api_router)


@app.on_event("startup")
async def on_startup():
    try:
        await ensure_indexes()
        logger.info("MongoDB indexes ensured")
    except Exception as e:
        logger.error(f"Index creation failed: {e}")
    try:
        if init_storage():
            logger.info("Object storage initialized")
    except Exception as e:
        logger.warning(f"Storage init skipped: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    get_client().close()


# CORS — allow specific frontend origin(s) + credentials
_origins_env = os.environ.get("CORS_ORIGINS", "*")
if _origins_env.strip() == "*":
    _allow_origins = ["*"]
    _allow_credentials = False
else:
    _allow_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
    _allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
