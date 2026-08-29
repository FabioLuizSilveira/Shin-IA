from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Shinã Landing API")
api_router = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Models ----------
class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    phone: Optional[str] = None
    profile: Optional[str] = None  # "locador" | "locatario"
    fleet_size: Optional[str] = None
    plan: Optional[str] = None
    source: Optional[str] = None
    locale: Optional[str] = "pt"
    created_at: str = Field(default_factory=now_iso)


class LeadCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    profile: Optional[str] = None
    fleet_size: Optional[str] = None
    plan: Optional[str] = None
    source: Optional[str] = None
    locale: Optional[str] = "pt"


class AnalyticsEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event: str
    label: Optional[str] = None
    section: Optional[str] = None
    locale: Optional[str] = "pt"
    value: Optional[float] = None
    created_at: str = Field(default_factory=now_iso)


class AnalyticsEventCreate(BaseModel):
    event: str
    label: Optional[str] = None
    section: Optional[str] = None
    locale: Optional[str] = "pt"
    value: Optional[float] = None


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Shinã API online", "status": "ok"}


@api_router.post("/leads", response_model=Lead)
async def create_lead(payload: LeadCreate):
    lead = Lead(**payload.model_dump())
    await db.leads.insert_one(lead.model_dump())
    logger.info(f"New lead captured: {lead.email} ({lead.profile})")
    return lead


@api_router.get("/leads", response_model=List[Lead])
async def list_leads():
    docs = await db.leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.post("/events", response_model=AnalyticsEvent)
async def track_event(payload: AnalyticsEventCreate):
    evt = AnalyticsEvent(**payload.model_dump())
    await db.events.insert_one(evt.model_dump())
    return evt


@api_router.get("/analytics/summary")
async def analytics_summary():
    total_leads = await db.leads.count_documents({})
    total_events = await db.events.count_documents({})
    pipeline = [{"$group": {"_id": "$event", "count": {"$sum": 1}}}]
    by_event = await db.events.aggregate(pipeline).to_list(100)
    return {
        "total_leads": total_leads,
        "total_events": total_events,
        "by_event": {row["_id"]: row["count"] for row in by_event},
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
