"""Database engine and session setup.

Dev uses SQLite (zero install); set DATABASE_URL to a Postgres URL when we
move to Supabase — models use portable column types (JSON instead of ARRAY)
so the switch is a config change, not a rewrite.
"""

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

DATABASE_URL = os.environ.get(
    "DATABASE_URL", f"sqlite:///{DATA_DIR / 'regulations.db'}"
)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
    if DATABASE_URL.startswith("sqlite")
    else {},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    """Create tables that don't exist yet. Safe to call repeatedly."""
    from app import models  # noqa: F401  (register models with Base)

    Base.metadata.create_all(engine)
