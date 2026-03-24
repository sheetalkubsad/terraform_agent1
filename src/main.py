"""Main FastAPI application entry point."""
import os
import logging
import vertexai
import google.generativeai as genai
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from src.routes import router
from src.shared.settings import get_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Get settings
settings = get_settings()

# Configure Google AI
genai.configure(api_key=settings.gemini_api_key)
vertexai.init(project=settings.google_cloud_project, location=settings.google_cloud_location)

logger.info(f"🚀 Application starting - App: {settings.app_name}")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    app = FastAPI(
        title=settings.app_name,
        description="AI-powered infrastructure automation platform",
        version="1.0.0",
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include API routers first
    app.include_router(router, prefix="/api")

    # Serve static files from the built frontend
    main_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    frontend_path = os.path.join(main_dir, "ai-infra-scribe", "dist")
    
    logger.info(f"📁 Checking frontend path: {frontend_path}")
    if os.path.exists(frontend_path):
        assets_path = os.path.join(frontend_path, "assets")
        if os.path.exists(assets_path):
            logger.info(f"✅ Assets path found: {assets_path}")
            app.mount("/assets", StaticFiles(directory=assets_path), name="assets")
        
        @app.get("/{full_path:path}")
        async def serve_frontend(full_path: str):
            # If the path looks like a file (has an extension), try to serve it
            if "." in full_path:
                potential_file = os.path.join(frontend_path, full_path)
                if os.path.exists(potential_file):
                    return FileResponse(potential_file)
            
            # Default to index.html for React SPA routing
            index_path = os.path.join(frontend_path, "index.html")
            if os.path.exists(index_path):
                return FileResponse(index_path)
            return {"detail": "Frontend index.html not found"}
    else:
        logger.warning(f"❌ Frontend path NOT found: {frontend_path}")

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=True
    )
