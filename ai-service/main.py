from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import analyze, chat


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("FinSight AI service starting up")
    yield
    print("FinSight AI service shutting down")


app = FastAPI(
    title="FinSight AI Service",
    description="Portfolio intelligence powered by Anthropic Claude",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

app.include_router(analyze.router, prefix="/analyze", tags=["analyze"])
app.include_router(chat.router,   prefix="/chat",    tags=["chat"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "finsight-ai"}
