import os
import pytest
import requests

BASE_URL = "https://carrent-pro-10.preview.emergentagent.com"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, email, password):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    return data["token"], data["user"]


@pytest.fixture(scope="session")
def locador_auth(api_client):
    token, user = _login(api_client, "locador@demo.com", "demo1234")
    return {"token": token, "user": user, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="session")
def locatario_auth(api_client):
    token, user = _login(api_client, "locatario@demo.com", "demo1234")
    return {"token": token, "user": user, "headers": {"Authorization": f"Bearer {token}"}}
