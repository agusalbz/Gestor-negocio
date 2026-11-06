from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.constants import CASH_MOVEMENT_IN, SALE_STATUS_CREDIT
from app.models.cash_movement import CashMovement
from app.models.client import Client
from app.models.product import Product


def test_client_debt_and_payment_flow(client: TestClient, db_session: Session) -> None:
    cust = Client(name="Juan Perez", dni="30111222")
    prod = Product(name="Arroz 1kg", price=1500.0, stock=20)
    db_session.add_all([cust, prod])
    db_session.commit()

    # 1. Register a credit sale (fiado) for 2 items ($3000)
    sale_res = client.post(
        "/api/sales/",
        json={
            "client_id": cust.id,
            "status": SALE_STATUS_CREDIT,
            "items": [
                {
                    "product_id": prod.id,
                    "quantity": 2,
                    "discount_rate": 0.0,
                }
            ],
            "payment": None,
        },
    )
    assert sale_res.status_code == 201

    # 2. Check client list returns total_debt = 3000
    list_res = client.get("/api/clients/")
    assert list_res.status_code == 200
    clients_data = list_res.json()
    matched = next((c for c in clients_data if c["id"] == cust.id), None)
    assert matched is not None
    assert matched["total_debt"] == 3000.0

    # 3. Check account statement
    account_res = client.get(f"/api/clients/{cust.id}/account")
    assert account_res.status_code == 200
    account_data = account_res.json()
    assert account_data["total_debt"] == 3000.0
    assert len(account_data["pending_sales"]) == 1
    assert account_data["pending_sales"][0]["balance"] == 3000.0

    # 4. Register a payment of $2000 on account
    pay_res = client.post(
        f"/api/clients/{cust.id}/payments",
        json={
            "amount": 2000.0,
            "payment_method": 0,
        },
    )
    assert pay_res.status_code == 200
    updated_account = pay_res.json()
    assert updated_account["total_debt"] == 1000.0
    assert updated_account["pending_sales"][0]["balance"] == 1000.0

    # 5. Verify CashMovement IN was created
    movements = (
        db_session.query(CashMovement)
        .filter(CashMovement.movement_type == CASH_MOVEMENT_IN)
        .all()
    )
    assert any(float(m.amount) == 2000.0 for m in movements)
