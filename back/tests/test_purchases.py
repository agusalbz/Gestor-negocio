from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.constants import (
    CASH_MOVEMENT_OUT,
    PURCHASE_STATUS_CREDIT,
    PURCHASE_STATUS_PAID,
)
from app.models.cash_movement import CashMovement
from app.models.product import Product
from app.models.supplier import Supplier


def test_create_cash_purchase_increases_stock_and_updates_cost(client: TestClient, db_session: Session) -> None:
    supplier = Supplier(name="Distribuidora Central")
    product = Product(name="Harina 1kg", price=1200.0, cost_price=700.0, stock=10)
    db_session.add_all([supplier, product])
    db_session.commit()

    response = client.post(
        "/api/purchases/",
        json={
            "supplier_id": supplier.id,
            "invoice_number": "FC-001",
            "status": PURCHASE_STATUS_PAID,
            "items": [
                {
                    "product_id": product.id,
                    "quantity": 15,
                    "unit_cost": 850.0,
                }
            ],
            "payment": {
                "amount": 12750.0,
                "payment_method": 0,
            },
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["total_amount"] == 12750.0
    assert data["status"] == PURCHASE_STATUS_PAID
    assert data["summary"]["balance"] == 0.0

    # Verify product stock and cost price updated
    db_session.refresh(product)
    assert product.stock == 25  # 10 + 15
    assert float(product.cost_price) == 850.0

    # Verify CashMovement OUT was created
    movement = db_session.query(CashMovement).filter(CashMovement.purchase_id == data["id"]).first()
    assert movement is not None
    assert movement.movement_type == CASH_MOVEMENT_OUT
    assert float(movement.amount) == 12750.0


def test_credit_purchase_and_subsequent_payment(client: TestClient, db_session: Session) -> None:
    supplier = Supplier(name="Lacteos del Sur")
    product = Product(name="Leche Entera", price=1000.0, cost_price=600.0, stock=5)
    db_session.add_all([supplier, product])
    db_session.commit()

    # 1. Create on credit (a pagar)
    create_res = client.post(
        "/api/purchases/",
        json={
            "supplier_id": supplier.id,
            "invoice_number": "REM-992",
            "status": PURCHASE_STATUS_CREDIT,
            "items": [
                {
                    "product_id": product.id,
                    "quantity": 20,
                    "unit_cost": 650.0,
                }
            ],
        },
    )
    assert create_res.status_code == 201
    purchase_data = create_res.json()
    assert purchase_data["total_amount"] == 13000.0
    assert purchase_data["summary"]["balance"] == 13000.0

    db_session.refresh(product)
    assert product.stock == 25

    # 2. Register partial payment of 5000 in cash
    pay_res = client.post(
        f"/api/purchases/{purchase_data['id']}/payments",
        json={
            "amount": 5000.0,
            "payment_method": 0,
        },
    )
    assert pay_res.status_code == 200
    updated_data = pay_res.json()
    assert updated_data["summary"]["total_paid"] == 5000.0
    assert updated_data["summary"]["balance"] == 8000.0
