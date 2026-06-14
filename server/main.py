from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from dotenv import load_dotenv
import uvicorn

load_dotenv(Path(__file__).parent / ".env")

app = FastAPI(
    title="AgriX API",
    description="Smart Farming Assistant Backend",
    version="1.0.0"
)

from api.routes import auth, farming, user

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(farming.router, prefix="/api/farming", tags=["farming"])
app.include_router(user.router, prefix="/api/user", tags=["user"])


@app.get("/")
async def root():
    return {"message": "Welcome to the AgriX API. Form follows function."}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
