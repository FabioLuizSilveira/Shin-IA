"""Regression tests for Shina Landing API endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://shina-rental-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_root(client):
    r = client.get(f"{API}/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"


def test_create_lead_and_persistence(client):
    payload = {
        "name": "TEST_Regression User",
        "email": "test_regression@example.com",
        "profile": "locador",
        "locale": "pt",
        "source": "regression_test",
    }
    r = client.post(f"{API}/leads", json=payload)
    assert r.status_code == 200, r.text
    lead = r.json()
    assert lead["email"] == payload["email"]
    assert lead["name"] == payload["name"]
    assert lead["profile"] == "locador"
    assert "id" in lead and len(lead["id"]) > 0
    assert "created_at" in lead

    # Verify persistence via GET
    r2 = client.get(f"{API}/leads")
    assert r2.status_code == 200
    leads = r2.json()
    assert any(l["email"] == payload["email"] for l in leads)
    # Ensure _id is stripped
    assert all("_id" not in l for l in leads)


def test_create_lead_invalid_email(client):
    r = client.post(f"{API}/leads", json={"name": "X", "email": "not-an-email"})
    assert r.status_code == 422


def test_track_event(client):
    r = client.post(f"{API}/events", json={
        "event": "test_regression_event",
        "label": "regression",
        "section": "hero",
        "locale": "en"
    })
    assert r.status_code == 200, r.text
    evt = r.json()
    assert evt["event"] == "test_regression_event"
    assert evt["locale"] == "en"
    assert "id" in evt


def test_analytics_summary(client):
    r = client.get(f"{API}/analytics/summary")
    assert r.status_code == 200
    data = r.json()
    assert "total_leads" in data
    assert "total_events" in data
    assert isinstance(data["total_leads"], int)
    assert isinstance(data["total_events"], int)
    assert data["total_leads"] >= 1
    assert data["total_events"] >= 1
    assert "by_event" in data
