from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
import logging
from mangum import Mangum

app = FastAPI()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "https://tvhero.vercel.app",
        "https://tvhero-git-main-geras-projects-5ef45cdd.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    logger.info("Health check endpoint called")
    return {"status": "ok"}


@app.get("/fetch_stream")
async def fetch_stream(
    request: Request,
    title: str = Query(None),
    season: int = Query(None),
    episode: int = Query(None),
):
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    logger.info(
        f"Fetching stream for title: {title}, season: {season}, episode: {episode}"
    )
    return {"title_received": title, "message": "Test response"}


# Mangum handler for Vercel serverless
handler = Mangum(app)
