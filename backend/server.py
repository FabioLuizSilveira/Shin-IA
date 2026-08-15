from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import jwt
import bcrypt
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = os.environ.get('JWT_ALG', 'HS256')
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')

app = FastAPI(title="Car Rental Management API")
api = APIRouter(prefix="/api")


# ---------- Utils ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def uid(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), h.encode())
    except Exception:
        return False


def create_jwt(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "iat": int(now_utc().timestamp()),
        "exp": int((now_utc() + timedelta(days=30)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def current_user(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_role(role: str):
    async def dep(user=Depends(current_user)):
        if user.get("role") != role:
            raise HTTPException(status_code=403, detail=f"Requires role: {role}")
        return user
    return dep


# ---------- Models ----------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["locador", "locatario"]
    phone: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_id: str
    role: Optional[Literal["locador", "locatario"]] = None


class VehicleIn(BaseModel):
    make: str
    model: str
    year: int
    plate: str
    color: Optional[str] = None
    daily_rate: float
    photo_url: Optional[str] = None
    mileage_km: int = 0
    fuel: Optional[str] = None
    transmission: Optional[str] = None
    status: Literal["available", "rented", "maintenance"] = "available"
    description: Optional[str] = None


class ContractIn(BaseModel):
    vehicle_id: str
    locatario_email: EmailStr
    start_date: str  # ISO
    end_date: str    # ISO
    monthly_amount: float
    deposit: float = 0
    terms: Optional[str] = None


class PaymentIn(BaseModel):
    contract_id: str
    amount: float
    method: Literal["stripe", "manual", "pix", "cash"] = "manual"
    note: Optional[str] = None


class MaintenanceIn(BaseModel):
    vehicle_id: str
    kind: str  # e.g. oil change, tires, revision
    scheduled_date: str  # ISO
    notes: Optional[str] = None
    cost: Optional[float] = None


class MaintenanceUpdate(BaseModel):
    status: Literal["scheduled", "in_progress", "completed"]
    completion_date: Optional[str] = None
    cost: Optional[float] = None
    notes: Optional[str] = None


class LocationIn(BaseModel):
    vehicle_id: str
    lat: float
    lng: float
    speed_kmh: Optional[float] = None


class MessageIn(BaseModel):
    contract_id: str
    to_user_id: Optional[str] = None
    text: str


class SignatureIn(BaseModel):
    signature_data: str  # base64 or text signature


# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.vehicles.create_index("vehicle_id", unique=True)
    await db.vehicles.create_index("owner_id")
    await db.contracts.create_index("contract_id", unique=True)
    await db.contracts.create_index("locador_id")
    await db.contracts.create_index("locatario_id")
    await db.payments.create_index("payment_id", unique=True)
    await db.maintenance.create_index("maintenance_id", unique=True)
    await db.messages.create_index("contract_id")
    await db.locations.create_index("vehicle_id")
    # Seed demo data if empty
    if await db.users.count_documents({}) == 0:
        await _seed_demo()


async def _seed_demo():
    locador_id = uid("usr")
    locatario_id = uid("usr")
    await db.users.insert_many([
        {
            "user_id": locador_id,
            "name": "Carlos Locador",
            "email": "locador@demo.com",
            "phone": "+55 11 90000-0001",
            "role": "locador",
            "password_hash": hash_password("demo1234"),
            "created_at": now_utc(),
            "provider": "email",
        },
        {
            "user_id": locatario_id,
            "name": "Ana Locatária",
            "email": "locatario@demo.com",
            "phone": "+55 11 90000-0002",
            "role": "locatario",
            "password_hash": hash_password("demo1234"),
            "created_at": now_utc(),
            "provider": "email",
        },
    ])
    photos = [
        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800",
        "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800",
        "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800",
        "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=800",
    ]
    vehicles = []
    samples = [
        ("Toyota", "Corolla", 2023, "ABC1D23", "Prata", 180.0, "available"),
        ("Honda", "Civic", 2022, "DEF2E34", "Preto", 220.0, "rented"),
        ("Volkswagen", "Nivus", 2024, "GHI3F45", "Branco", 240.0, "available"),
        ("Chevrolet", "Onix", 2023, "JKL4G56", "Vermelho", 150.0, "maintenance"),
    ]
    for i, (mk, md, yr, pl, cl, rate, st) in enumerate(samples):
        vehicles.append({
            "vehicle_id": uid("veh"),
            "owner_id": locador_id,
            "make": mk, "model": md, "year": yr, "plate": pl, "color": cl,
            "daily_rate": rate, "mileage_km": 15000 + i * 5000,
            "fuel": "Flex", "transmission": "Automático",
            "status": st, "photo_url": photos[i],
            "description": f"{mk} {md} {yr} em ótimo estado.",
            "created_at": now_utc(),
        })
    await db.vehicles.insert_many(vehicles)
    # Contract for rented vehicle
    rented = next(v for v in vehicles if v["status"] == "rented")
    contract_id = uid("ctr")
    await db.contracts.insert_one({
        "contract_id": contract_id,
        "vehicle_id": rented["vehicle_id"],
        "locador_id": locador_id,
        "locatario_id": locatario_id,
        "start_date": (now_utc() - timedelta(days=15)).isoformat(),
        "end_date": (now_utc() + timedelta(days=75)).isoformat(),
        "monthly_amount": 2800.0,
        "deposit": 1000.0,
        "terms": "Contrato de locação mensal. Combustível por conta do locatário. Manutenções preventivas por conta do locador.",
        "status": "active",
        "signature_locador": None,
        "signature_locatario": None,
        "created_at": now_utc(),
    })
    # Payment history
    for i in range(2):
        await db.payments.insert_one({
            "payment_id": uid("pay"),
            "contract_id": contract_id,
            "amount": 2800.0,
            "method": "pix",
            "status": "paid",
            "note": f"Mensalidade {i+1}",
            "created_at": now_utc() - timedelta(days=30 * (2 - i)),
        })
    # Maintenance
    for vh in vehicles[:2]:
        await db.maintenance.insert_one({
            "maintenance_id": uid("mnt"),
            "vehicle_id": vh["vehicle_id"],
            "kind": "Troca de óleo",
            "scheduled_date": (now_utc() + timedelta(days=10)).isoformat(),
            "status": "scheduled",
            "notes": "Óleo sintético 5W30",
            "cost": 250.0,
            "created_at": now_utc(),
        })
    # Location for rented
    await db.locations.insert_one({
        "vehicle_id": rented["vehicle_id"],
        "lat": -23.5505,
        "lng": -46.6333,
        "speed_kmh": 0,
        "updated_at": now_utc(),
    })


# ---------- Auth ----------
@api.post("/auth/register")
async def register(inp: RegisterIn):
    if await db.users.find_one({"email": inp.email.lower()}):
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    user_id = uid("usr")
    doc = {
        "user_id": user_id,
        "name": inp.name,
        "email": inp.email.lower(),
        "phone": inp.phone,
        "role": inp.role,
        "password_hash": hash_password(inp.password),
        "created_at": now_utc(),
        "provider": "email",
    }
    await db.users.insert_one(doc)
    token = create_jwt(user_id, inp.role)
    return {"token": token, "user": {"user_id": user_id, "name": inp.name, "email": inp.email.lower(), "role": inp.role, "phone": inp.phone}}


@api.post("/auth/login")
async def login(inp: LoginIn):
    user = await db.users.find_one({"email": inp.email.lower()})
    if not user or not verify_password(inp.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    token = create_jwt(user["user_id"], user["role"])
    return {
        "token": token,
        "user": {"user_id": user["user_id"], "name": user["name"], "email": user["email"], "role": user["role"], "phone": user.get("phone")},
    }


@api.post("/auth/google-session")
async def google_session(inp: GoogleSessionIn):
    # Exchange session_id with Emergent auth service
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            r = await http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": inp.session_id},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Sessão inválida")
        data = r.json()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Falha ao validar sessão")

    email = (data.get("email") or "").lower()
    name = data.get("name") or email.split("@")[0]
    if not email:
        raise HTTPException(status_code=401, detail="Email não retornado")
    user = await db.users.find_one({"email": email})
    if not user:
        role = inp.role or "locatario"
        user_id = uid("usr")
        user = {
            "user_id": user_id,
            "name": name,
            "email": email,
            "role": role,
            "phone": None,
            "provider": "google",
            "avatar": data.get("picture"),
            "created_at": now_utc(),
        }
        await db.users.insert_one(user)
    token = create_jwt(user["user_id"], user["role"])
    return {
        "token": token,
        "user": {"user_id": user["user_id"], "name": user["name"], "email": user["email"], "role": user["role"], "phone": user.get("phone")},
    }


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return {"user": user}


# ---------- Vehicles ----------
@api.get("/vehicles")
async def list_vehicles(status: Optional[str] = None, mine: bool = False, user=Depends(current_user)):
    q = {}
    if status:
        q["status"] = status
    if mine and user["role"] == "locador":
        q["owner_id"] = user["user_id"]
    items = await db.vehicles.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"items": items}


@api.get("/vehicles/{vehicle_id}")
async def get_vehicle(vehicle_id: str, user=Depends(current_user)):
    v = await db.vehicles.find_one({"vehicle_id": vehicle_id}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Veículo não encontrado")
    return v


@api.post("/vehicles")
async def create_vehicle(inp: VehicleIn, user=Depends(require_role("locador"))):
    doc = inp.model_dump()
    doc["vehicle_id"] = uid("veh")
    doc["owner_id"] = user["user_id"]
    doc["created_at"] = now_utc()
    await db.vehicles.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/vehicles/{vehicle_id}")
async def update_vehicle(vehicle_id: str, inp: VehicleIn, user=Depends(require_role("locador"))):
    v = await db.vehicles.find_one({"vehicle_id": vehicle_id})
    if not v or v["owner_id"] != user["user_id"]:
        raise HTTPException(404, "Veículo não encontrado")
    await db.vehicles.update_one({"vehicle_id": vehicle_id}, {"$set": inp.model_dump()})
    v = await db.vehicles.find_one({"vehicle_id": vehicle_id}, {"_id": 0})
    return v


@api.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, user=Depends(require_role("locador"))):
    active = await db.contracts.count_documents({"vehicle_id": vehicle_id, "status": {"$in": ["active", "pending"]}})
    if active > 0:
        raise HTTPException(409, "Veículo possui contrato ativo/pendente. Encerre o contrato antes de excluir.")
    r = await db.vehicles.delete_one({"vehicle_id": vehicle_id, "owner_id": user["user_id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Não encontrado")
    return {"ok": True}


# ---------- Contracts ----------
@api.get("/contracts")
async def list_contracts(user=Depends(current_user)):
    q = {"locador_id": user["user_id"]} if user["role"] == "locador" else {"locatario_id": user["user_id"]}
    items = await db.contracts.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Enrich with vehicle info
    vids = list({c["vehicle_id"] for c in items})
    vehicles = {v["vehicle_id"]: v for v in await db.vehicles.find({"vehicle_id": {"$in": vids}}, {"_id": 0}).to_list(500)}
    for c in items:
        c["vehicle"] = vehicles.get(c["vehicle_id"])
    return {"items": items}


@api.get("/contracts/{contract_id}")
async def get_contract(contract_id: str, user=Depends(current_user)):
    c = await db.contracts.find_one({"contract_id": contract_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Contrato não encontrado")
    if user["user_id"] not in (c["locador_id"], c["locatario_id"]):
        raise HTTPException(403, "Acesso negado")
    c["vehicle"] = await db.vehicles.find_one({"vehicle_id": c["vehicle_id"]}, {"_id": 0})
    c["locador"] = await db.users.find_one({"user_id": c["locador_id"]}, {"_id": 0, "password_hash": 0})
    c["locatario"] = await db.users.find_one({"user_id": c["locatario_id"]}, {"_id": 0, "password_hash": 0})
    return c


@api.post("/contracts")
async def create_contract(inp: ContractIn, user=Depends(require_role("locador"))):
    v = await db.vehicles.find_one({"vehicle_id": inp.vehicle_id, "owner_id": user["user_id"]})
    if not v:
        raise HTTPException(404, "Veículo não encontrado")
    locatario = await db.users.find_one({"email": inp.locatario_email.lower(), "role": "locatario"})
    if not locatario:
        raise HTTPException(404, "Locatário não encontrado. Peça para se cadastrar primeiro.")
    doc = {
        "contract_id": uid("ctr"),
        "vehicle_id": inp.vehicle_id,
        "locador_id": user["user_id"],
        "locatario_id": locatario["user_id"],
        "start_date": inp.start_date,
        "end_date": inp.end_date,
        "monthly_amount": inp.monthly_amount,
        "deposit": inp.deposit,
        "terms": inp.terms or "",
        "status": "pending",
        "signature_locador": None,
        "signature_locatario": None,
        "created_at": now_utc(),
    }
    await db.contracts.insert_one(doc)
    await db.vehicles.update_one({"vehicle_id": inp.vehicle_id}, {"$set": {"status": "rented"}})
    doc.pop("_id", None)
    return doc


@api.post("/contracts/{contract_id}/sign")
async def sign_contract(contract_id: str, inp: SignatureIn, user=Depends(current_user)):
    c = await db.contracts.find_one({"contract_id": contract_id})
    if not c:
        raise HTTPException(404, "Contrato não encontrado")
    field = None
    if user["user_id"] == c["locador_id"]:
        field = "signature_locador"
    elif user["user_id"] == c["locatario_id"]:
        field = "signature_locatario"
    else:
        raise HTTPException(403, "Acesso negado")
    signature = {"data": inp.signature_data, "signed_at": now_utc().isoformat()}
    update = {field: signature}
    c2 = {**c, **update}
    if c2.get("signature_locador") and c2.get("signature_locatario"):
        update["status"] = "active"
    await db.contracts.update_one({"contract_id": contract_id}, {"$set": update})
    return {"ok": True}


@api.get("/contracts/{contract_id}/pdf")
async def contract_pdf(contract_id: str, user=Depends(current_user)):
    c = await db.contracts.find_one({"contract_id": contract_id}, {"_id": 0})
    if not c or user["user_id"] not in (c["locador_id"], c["locatario_id"]):
        raise HTTPException(404, "Contrato não encontrado")
    veh = await db.vehicles.find_one({"vehicle_id": c["vehicle_id"]}, {"_id": 0})
    locador = await db.users.find_one({"user_id": c["locador_id"]}, {"_id": 0})
    locatario = await db.users.find_one({"user_id": c["locatario_id"]}, {"_id": 0})

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title=f"Contrato {contract_id}")
    styles = getSampleStyleSheet()
    parts = []
    parts.append(Paragraph("<b>CONTRATO DE LOCAÇÃO DE VEÍCULO</b>", styles["Title"]))
    parts.append(Spacer(1, 12))
    parts.append(Paragraph(f"<b>Contrato ID:</b> {c['contract_id']}", styles["Normal"]))
    parts.append(Paragraph(f"<b>Status:</b> {c['status']}", styles["Normal"]))
    parts.append(Spacer(1, 8))
    parts.append(Paragraph("<b>Partes:</b>", styles["Heading2"]))
    parts.append(Paragraph(f"Locador: {locador['name']} ({locador['email']})", styles["Normal"]))
    parts.append(Paragraph(f"Locatário: {locatario['name']} ({locatario['email']})", styles["Normal"]))
    parts.append(Spacer(1, 8))
    parts.append(Paragraph("<b>Veículo:</b>", styles["Heading2"]))
    if veh:
        parts.append(Paragraph(f"{veh['make']} {veh['model']} {veh['year']} — Placa {veh['plate']}", styles["Normal"]))
    parts.append(Spacer(1, 8))
    parts.append(Paragraph("<b>Prazo:</b>", styles["Heading2"]))
    parts.append(Paragraph(f"De {c['start_date'][:10]} até {c['end_date'][:10]}", styles["Normal"]))
    parts.append(Spacer(1, 8))
    parts.append(Paragraph("<b>Valores:</b>", styles["Heading2"]))
    parts.append(Paragraph(f"Mensalidade: R$ {c['monthly_amount']:.2f}", styles["Normal"]))
    parts.append(Paragraph(f"Caução: R$ {c['deposit']:.2f}", styles["Normal"]))
    parts.append(Spacer(1, 8))
    parts.append(Paragraph("<b>Termos:</b>", styles["Heading2"]))
    parts.append(Paragraph(c.get("terms") or "—", styles["Normal"]))
    parts.append(Spacer(1, 16))
    parts.append(Paragraph(
        f"Assinatura Locador: {'ASSINADO em ' + c['signature_locador']['signed_at'][:19] if c.get('signature_locador') else 'PENDENTE'}",
        styles["Normal"],
    ))
    parts.append(Paragraph(
        f"Assinatura Locatário: {'ASSINADO em ' + c['signature_locatario']['signed_at'][:19] if c.get('signature_locatario') else 'PENDENTE'}",
        styles["Normal"],
    ))
    doc.build(parts)
    buf.seek(0)
    return Response(content=buf.read(), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="contrato-{contract_id}.pdf"'})


# ---------- Payments ----------
@api.get("/payments")
async def list_payments(contract_id: Optional[str] = None, user=Depends(current_user)):
    if contract_id:
        c = await db.contracts.find_one({"contract_id": contract_id})
        if not c or user["user_id"] not in (c["locador_id"], c["locatario_id"]):
            raise HTTPException(403, "Acesso negado")
        items = await db.payments.find({"contract_id": contract_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    else:
        # find contracts of user
        q = {"locador_id": user["user_id"]} if user["role"] == "locador" else {"locatario_id": user["user_id"]}
        cids = [c["contract_id"] for c in await db.contracts.find(q, {"_id": 0, "contract_id": 1}).to_list(500)]
        items = await db.payments.find({"contract_id": {"$in": cids}}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"items": items}


@api.post("/payments")
async def add_payment(inp: PaymentIn, user=Depends(current_user)):
    c = await db.contracts.find_one({"contract_id": inp.contract_id})
    if not c or user["user_id"] not in (c["locador_id"], c["locatario_id"]):
        raise HTTPException(403, "Acesso negado")
    doc = {
        "payment_id": uid("pay"),
        "contract_id": inp.contract_id,
        "amount": inp.amount,
        "method": inp.method,
        "status": "paid" if inp.method != "stripe" else "pending",
        "note": inp.note,
        "created_at": now_utc(),
    }
    await db.payments.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.post("/payments/stripe-checkout")
async def stripe_checkout(inp: PaymentIn, user=Depends(current_user)):
    """Create a Stripe Checkout Session. Requires STRIPE_SECRET_KEY."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(400, "Stripe não configurado. Adicione STRIPE_SECRET_KEY no backend/.env")
    import stripe
    stripe.api_key = STRIPE_SECRET_KEY
    c = await db.contracts.find_one({"contract_id": inp.contract_id})
    if not c or user["user_id"] not in (c["locador_id"], c["locatario_id"]):
        raise HTTPException(403, "Acesso negado")
    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=[{
            "price_data": {
                "currency": "brl",
                "product_data": {"name": f"Pagamento contrato {inp.contract_id}"},
                "unit_amount": int(round(inp.amount * 100)),
            },
            "quantity": 1,
        }],
        success_url="https://example.com/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url="https://example.com/cancel",
        metadata={"contract_id": inp.contract_id, "user_id": user["user_id"]},
    )
    return {"url": session.url, "session_id": session.id}


# ---------- Maintenance ----------
@api.get("/maintenance")
async def list_maintenance(vehicle_id: Optional[str] = None, user=Depends(current_user)):
    if vehicle_id:
        q = {"vehicle_id": vehicle_id}
    else:
        if user["role"] == "locador":
            vids = [v["vehicle_id"] for v in await db.vehicles.find({"owner_id": user["user_id"]}, {"_id": 0, "vehicle_id": 1}).to_list(500)]
        else:
            # locatario: vehicles in their active contracts
            cids = await db.contracts.find({"locatario_id": user["user_id"]}, {"_id": 0, "vehicle_id": 1}).to_list(500)
            vids = list({c["vehicle_id"] for c in cids})
        q = {"vehicle_id": {"$in": vids}}
    items = await db.maintenance.find(q, {"_id": 0}).sort("scheduled_date", 1).to_list(500)
    return {"items": items}


@api.post("/maintenance")
async def add_maintenance(inp: MaintenanceIn, user=Depends(require_role("locador"))):
    v = await db.vehicles.find_one({"vehicle_id": inp.vehicle_id, "owner_id": user["user_id"]})
    if not v:
        raise HTTPException(404, "Veículo não encontrado")
    doc = inp.model_dump()
    doc["maintenance_id"] = uid("mnt")
    doc["status"] = "scheduled"
    doc["created_at"] = now_utc()
    await db.maintenance.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/maintenance/{maintenance_id}")
async def update_maintenance(maintenance_id: str, inp: MaintenanceUpdate, user=Depends(require_role("locador"))):
    m = await db.maintenance.find_one({"maintenance_id": maintenance_id})
    if not m:
        raise HTTPException(404, "Não encontrado")
    v = await db.vehicles.find_one({"vehicle_id": m["vehicle_id"], "owner_id": user["user_id"]})
    if not v:
        raise HTTPException(403, "Acesso negado")
    update = {k: v for k, v in inp.model_dump().items() if v is not None}
    await db.maintenance.update_one({"maintenance_id": maintenance_id}, {"$set": update})
    return {"ok": True}


# ---------- Location / Monitoring ----------
@api.get("/locations/{vehicle_id}")
async def get_location(vehicle_id: str, user=Depends(current_user)):
    loc = await db.locations.find_one({"vehicle_id": vehicle_id}, {"_id": 0})
    if not loc:
        # Return mocked default if none
        return {"vehicle_id": vehicle_id, "lat": -23.5505, "lng": -46.6333, "updated_at": now_utc().isoformat(), "mocked": True}
    if isinstance(loc.get("updated_at"), datetime):
        loc["updated_at"] = loc["updated_at"].isoformat()
    return loc


@api.post("/locations")
async def push_location(inp: LocationIn, user=Depends(current_user)):
    doc = inp.model_dump()
    doc["updated_at"] = now_utc()
    await db.locations.update_one({"vehicle_id": inp.vehicle_id}, {"$set": doc}, upsert=True)
    return {"ok": True}


# ---------- Chat / Messages ----------
@api.get("/messages/{contract_id}")
async def list_messages(contract_id: str, user=Depends(current_user)):
    c = await db.contracts.find_one({"contract_id": contract_id})
    if not c or user["user_id"] not in (c["locador_id"], c["locatario_id"]):
        raise HTTPException(403, "Acesso negado")
    items = await db.messages.find({"contract_id": contract_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    for m in items:
        if isinstance(m.get("created_at"), datetime):
            m["created_at"] = m["created_at"].isoformat()
    return {"items": items}


@api.post("/messages")
async def send_message(inp: MessageIn, user=Depends(current_user)):
    c = await db.contracts.find_one({"contract_id": inp.contract_id})
    if not c or user["user_id"] not in (c["locador_id"], c["locatario_id"]):
        raise HTTPException(403, "Acesso negado")
    to_id = c["locador_id"] if user["user_id"] == c["locatario_id"] else c["locatario_id"]
    doc = {
        "message_id": uid("msg"),
        "contract_id": inp.contract_id,
        "from_user_id": user["user_id"],
        "to_user_id": to_id,
        "text": inp.text,
        "created_at": now_utc(),
    }
    await db.messages.insert_one(doc)
    doc.pop("_id", None)
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc


# ---------- Dashboard ----------
@api.get("/dashboard/summary")
async def dashboard_summary(user=Depends(current_user)):
    if user["role"] == "locador":
        vehicles = await db.vehicles.count_documents({"owner_id": user["user_id"]})
        active = await db.contracts.count_documents({"locador_id": user["user_id"], "status": "active"})
        pending = await db.contracts.count_documents({"locador_id": user["user_id"], "status": "pending"})
        maint = await db.maintenance.count_documents({"status": {"$in": ["scheduled", "in_progress"]}})
        # revenue this month
        start = now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        pipeline = [
            {"$match": {"created_at": {"$gte": start}, "status": "paid"}},
            {"$lookup": {"from": "contracts", "localField": "contract_id", "foreignField": "contract_id", "as": "c"}},
            {"$match": {"c.locador_id": user["user_id"]}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]
        agg = await db.payments.aggregate(pipeline).to_list(1)
        revenue = agg[0]["total"] if agg else 0
        return {"vehicles": vehicles, "active_contracts": active, "pending_contracts": pending, "maintenance_open": maint, "monthly_revenue": revenue}
    else:
        active = await db.contracts.count_documents({"locatario_id": user["user_id"], "status": "active"})
        pending_payments = 0  # placeholder
        cids = [c["contract_id"] for c in await db.contracts.find({"locatario_id": user["user_id"]}, {"_id": 0, "contract_id": 1}).to_list(200)]
        vids = list({c["vehicle_id"] for c in await db.contracts.find({"locatario_id": user["user_id"]}, {"_id": 0, "vehicle_id": 1}).to_list(200)})
        upcoming_maint = await db.maintenance.count_documents({"vehicle_id": {"$in": vids}, "status": "scheduled"})
        return {"active_contracts": active, "upcoming_maintenance": upcoming_maint, "pending_payments": pending_payments}


# ---------- Health ----------
@api.get("/")
async def root():
    return {"ok": True, "service": "car-rental-api"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
