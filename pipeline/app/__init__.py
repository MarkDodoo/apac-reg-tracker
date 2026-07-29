"""Loads pipeline/.env (if present) before any submodule reads os.environ.

This runs on `import app.<anything>` because Python executes a package's
__init__.py before its submodules. Local dev only — deployed environments
(Render) set real env vars, and load_dotenv() is a no-op with no .env file.
"""

from dotenv import load_dotenv

load_dotenv()
