"""End-to-end backend tests for Shinã I.A. Car Rental API."""
import os
import time
import requests
import pytest

BASE_URL = "https://carrent-pro-10.preview.emergentagent.com"


# ---------- Health ----------
def test_health(api_client):
    r = api_client.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ---------- Auth ----------
class TestAuth:
    def test_login_locador(self, locador_auth):
        assert locador_auth["user"]["role"] == "locador"
        assert locador_auth["user"]["email"] == "locador@demo.com"
        assert locador_auth["token"]

    def test_login_locatario(self, locatario_auth):
        assert locatario_auth["user"]["role"] == "locatario"

    def test_login_wrong_password(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": "locador@demo.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me_requires_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, api_client, locador_auth):
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers=locador_auth["headers"])
        assert r.status_code == 200
        assert r.json()["user"]["email"] == "locador@demo.com"

    def test_register_and_login(self, api_client):
        email = f"test_{int(time.time())}@example.com"
        r = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "TEST User", "email": email, "password": "abc12345", "role": "locatario"
        })
        assert r.status_code == 200, r.text
        assert "token" in r.json()
        # duplicate email
        r2 = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "TEST User", "email": email, "password": "abc12345", "role": "locatario"
        })
        assert r2.status_code == 400


# ---------- Dashboard ----------
class TestDashboard:
    def test_locador_summary(self, api_client, locador_auth):
        r = api_client.get(f"{BASE_URL}/api/dashboard/summary", headers=locador_auth["headers"])
        assert r.status_code == 200
        d = r.json()
        for k in ("vehicles", "active_contracts", "pending_contracts", "maintenance_open", "monthly_revenue"):
            assert k in d
        assert d["vehicles"] >= 4

    def test_locatario_summary(self, api_client, locatario_auth):
        r = api_client.get(f"{BASE_URL}/api/dashboard/summary", headers=locatario_auth["headers"])
        assert r.status_code == 200
        d = r.json()
        for k in ("active_contracts", "upcoming_maintenance", "pending_payments"):
            assert k in d


# ---------- Vehicles ----------
class TestVehicles:
    def test_list_all(self, api_client, locador_auth):
        r = api_client.get(f"{BASE_URL}/api/vehicles", headers=locador_auth["headers"])
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 4

    def test_list_mine_locador(self, api_client, locador_auth):
        r = api_client.get(f"{BASE_URL}/api/vehicles?mine=true", headers=locador_auth["headers"])
        assert r.status_code == 200
        assert len(r.json()["items"]) >= 4

    def test_status_filter(self, api_client, locador_auth):
        r = api_client.get(f"{BASE_URL}/api/vehicles?status=available", headers=locador_auth["headers"])
        assert r.status_code == 200
        for v in r.json()["items"]:
            assert v["status"] == "available"

    def test_locatario_cannot_create(self, api_client, locatario_auth):
        payload = {"make": "Fiat", "model": "Uno", "year": 2020, "plate": "XYZ9Z99", "daily_rate": 100}
        r = api_client.post(f"{BASE_URL}/api/vehicles", headers=locatario_auth["headers"], json=payload)
        assert r.status_code == 403

    def test_crud_flow(self, api_client, locador_auth):
        payload = {"make": "TEST_Fiat", "model": "Uno", "year": 2020, "plate": f"T{int(time.time())%99999}",
                   "daily_rate": 100.0, "status": "available"}
        r = api_client.post(f"{BASE_URL}/api/vehicles", headers=locador_auth["headers"], json=payload)
        assert r.status_code == 200, r.text
        vid = r.json()["vehicle_id"]

        # GET
        r = api_client.get(f"{BASE_URL}/api/vehicles/{vid}", headers=locador_auth["headers"])
        assert r.status_code == 200
        assert r.json()["make"] == "TEST_Fiat"
        assert "_id" not in r.json()

        # PUT
        payload["daily_rate"] = 130.0
        r = api_client.put(f"{BASE_URL}/api/vehicles/{vid}", headers=locador_auth["headers"], json=payload)
        assert r.status_code == 200
        assert r.json()["daily_rate"] == 130.0

        # DELETE
        r = api_client.delete(f"{BASE_URL}/api/vehicles/{vid}", headers=locador_auth["headers"])
        assert r.status_code == 200
        # verify
        r = api_client.get(f"{BASE_URL}/api/vehicles/{vid}", headers=locador_auth["headers"])
        assert r.status_code == 404


# ---------- Contracts ----------
class TestContracts:
    def test_list_locador(self, api_client, locador_auth):
        r = api_client.get(f"{BASE_URL}/api/contracts", headers=locador_auth["headers"])
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1
        assert items[0]["vehicle"] is not None

    def test_list_locatario(self, api_client, locatario_auth):
        r = api_client.get(f"{BASE_URL}/api/contracts", headers=locatario_auth["headers"])
        assert r.status_code == 200
        assert len(r.json()["items"]) >= 1

    def test_get_contract(self, api_client, locador_auth):
        r = api_client.get(f"{BASE_URL}/api/contracts", headers=locador_auth["headers"])
        cid = r.json()["items"][0]["contract_id"]
        r = api_client.get(f"{BASE_URL}/api/contracts/{cid}", headers=locador_auth["headers"])
        assert r.status_code == 200
        d = r.json()
        assert d["locador"] is not None and d["locatario"] is not None
        assert d["vehicle"] is not None

    def test_pdf(self, api_client, locador_auth):
        r = api_client.get(f"{BASE_URL}/api/contracts", headers=locador_auth["headers"])
        cid = r.json()["items"][0]["contract_id"]
        r = api_client.get(f"{BASE_URL}/api/contracts/{cid}/pdf", headers=locador_auth["headers"])
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"

    def test_locatario_cannot_create_contract(self, api_client, locatario_auth):
        r = api_client.post(f"{BASE_URL}/api/contracts", headers=locatario_auth["headers"], json={
            "vehicle_id": "x", "locatario_email": "l@l.com",
            "start_date": "2026-01-01T00:00:00", "end_date": "2026-02-01T00:00:00",
            "monthly_amount": 100.0
        })
        assert r.status_code == 403

    def test_create_sign_flow(self, api_client, locador_auth, locatario_auth):
        # create a new available vehicle
        vp = {"make": "TEST_Ford", "model": "Ka", "year": 2021, "plate": f"T{int(time.time())%88888}",
              "daily_rate": 90.0, "status": "available"}
        r = api_client.post(f"{BASE_URL}/api/vehicles", headers=locador_auth["headers"], json=vp)
        assert r.status_code == 200
        vid = r.json()["vehicle_id"]

        cp = {
            "vehicle_id": vid,
            "locatario_email": "locatario@demo.com",
            "start_date": "2026-01-01T00:00:00",
            "end_date": "2026-06-01T00:00:00",
            "monthly_amount": 1500.0,
            "deposit": 500.0,
            "terms": "TEST_terms"
        }
        r = api_client.post(f"{BASE_URL}/api/contracts", headers=locador_auth["headers"], json=cp)
        assert r.status_code == 200, r.text
        cid = r.json()["contract_id"]
        assert r.json()["status"] == "pending"

        # vehicle should be rented now
        r = api_client.get(f"{BASE_URL}/api/vehicles/{vid}", headers=locador_auth["headers"])
        assert r.json()["status"] == "rented"

        # sign as locador
        r = api_client.post(f"{BASE_URL}/api/contracts/{cid}/sign",
                            headers=locador_auth["headers"], json={"signature_data": "Carlos"})
        assert r.status_code == 200
        # sign as locatario
        r = api_client.post(f"{BASE_URL}/api/contracts/{cid}/sign",
                            headers=locatario_auth["headers"], json={"signature_data": "Ana"})
        assert r.status_code == 200
        # verify status active
        r = api_client.get(f"{BASE_URL}/api/contracts/{cid}", headers=locador_auth["headers"])
        assert r.json()["status"] == "active"

        # cleanup
        api_client.delete(f"{BASE_URL}/api/vehicles/{vid}", headers=locador_auth["headers"])


# ---------- Payments ----------
class TestPayments:
    def test_list_all(self, api_client, locador_auth):
        r = api_client.get(f"{BASE_URL}/api/payments", headers=locador_auth["headers"])
        assert r.status_code == 200

    def test_list_by_contract(self, api_client, locador_auth):
        cs = api_client.get(f"{BASE_URL}/api/contracts", headers=locador_auth["headers"]).json()["items"]
        # find any contract that has payments (seed contract does)
        found = False
        for c in cs:
            r = api_client.get(f"{BASE_URL}/api/payments?contract_id={c['contract_id']}", headers=locador_auth["headers"])
            assert r.status_code == 200
            if len(r.json()["items"]) >= 1:
                found = True
                break
        assert found, "Expected at least one contract with payments (seed data)"

    def test_add_payment(self, api_client, locador_auth):
        cs = api_client.get(f"{BASE_URL}/api/contracts", headers=locador_auth["headers"]).json()["items"]
        cid = cs[0]["contract_id"]
        r = api_client.post(f"{BASE_URL}/api/payments", headers=locador_auth["headers"],
                            json={"contract_id": cid, "amount": 500.0, "method": "pix", "note": "TEST"})
        assert r.status_code == 200
        assert r.json()["status"] == "paid"

    def test_stripe_not_configured(self, api_client, locador_auth):
        cs = api_client.get(f"{BASE_URL}/api/contracts", headers=locador_auth["headers"]).json()["items"]
        cid = cs[0]["contract_id"]
        r = api_client.post(f"{BASE_URL}/api/payments/stripe-checkout", headers=locador_auth["headers"],
                            json={"contract_id": cid, "amount": 100.0, "method": "stripe"})
        assert r.status_code == 400


# ---------- Maintenance ----------
class TestMaintenance:
    def test_list_locador(self, api_client, locador_auth):
        r = api_client.get(f"{BASE_URL}/api/maintenance", headers=locador_auth["headers"])
        assert r.status_code == 200

    def test_list_locatario(self, api_client, locatario_auth):
        r = api_client.get(f"{BASE_URL}/api/maintenance", headers=locatario_auth["headers"])
        assert r.status_code == 200

    def test_add_and_update(self, api_client, locador_auth):
        vehicles = api_client.get(f"{BASE_URL}/api/vehicles?mine=true", headers=locador_auth["headers"]).json()["items"]
        vid = vehicles[0]["vehicle_id"]
        r = api_client.post(f"{BASE_URL}/api/maintenance", headers=locador_auth["headers"], json={
            "vehicle_id": vid, "kind": "TEST_revision",
            "scheduled_date": "2026-02-01T00:00:00", "notes": "TEST", "cost": 300.0
        })
        assert r.status_code == 200
        mid = r.json()["maintenance_id"]

        r = api_client.put(f"{BASE_URL}/api/maintenance/{mid}", headers=locador_auth["headers"],
                           json={"status": "completed", "cost": 350.0})
        assert r.status_code == 200

    def test_locatario_cannot_create(self, api_client, locatario_auth):
        r = api_client.post(f"{BASE_URL}/api/maintenance", headers=locatario_auth["headers"], json={
            "vehicle_id": "x", "kind": "x", "scheduled_date": "2026-01-01T00:00:00"
        })
        assert r.status_code == 403


# ---------- Locations ----------
class TestLocations:
    def test_get_and_push(self, api_client, locador_auth):
        vehicles = api_client.get(f"{BASE_URL}/api/vehicles?mine=true", headers=locador_auth["headers"]).json()["items"]
        vid = vehicles[0]["vehicle_id"]
        r = api_client.get(f"{BASE_URL}/api/locations/{vid}", headers=locador_auth["headers"])
        assert r.status_code == 200
        r = api_client.post(f"{BASE_URL}/api/locations", headers=locador_auth["headers"],
                            json={"vehicle_id": vid, "lat": -23.5, "lng": -46.6, "speed_kmh": 50})
        assert r.status_code == 200


# ---------- Messages ----------
class TestMessages:
    def test_send_and_list(self, api_client, locador_auth, locatario_auth):
        cs = api_client.get(f"{BASE_URL}/api/contracts", headers=locador_auth["headers"]).json()["items"]
        cid = cs[0]["contract_id"]
        r = api_client.post(f"{BASE_URL}/api/messages", headers=locador_auth["headers"],
                            json={"contract_id": cid, "to_user_id": "auto", "text": "TEST_hello"})
        assert r.status_code == 200
        # locatario reads
        r = api_client.get(f"{BASE_URL}/api/messages/{cid}", headers=locatario_auth["headers"])
        assert r.status_code == 200
        assert any(m["text"] == "TEST_hello" for m in r.json()["items"])

    def test_access_control(self, api_client):
        # register a random user, try to access existing contract
        email = f"test_stranger_{int(time.time())}@example.com"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": "TEST Stranger", "email": email, "password": "abc12345", "role": "locatario"
        })
        token = r.json()["token"]
        h = {"Authorization": f"Bearer {token}"}
        # list contracts of locador to get a valid cid
        loc = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "locador@demo.com", "password": "demo1234"}).json()
        cid = requests.get(f"{BASE_URL}/api/contracts", headers={"Authorization": f"Bearer {loc['token']}"}).json()["items"][0]["contract_id"]
        r = requests.get(f"{BASE_URL}/api/messages/{cid}", headers=h)
        assert r.status_code == 403
