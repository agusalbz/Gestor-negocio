from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.constants import PURCHASE_STATUS_PAID, SALE_STATUS_PAID
from app.models.client import Client
from app.models.supplier import Supplier


def test_product_creation_records_initial_kardex(client: TestClient) -> None:
    create_res = client.post(
        "/api/products/",
        json={
            "name": "Aceite de Girasol 900ml",
            "price": 1500.0,
            "cost_price": 950.0,
            "stock": 25,
            "min_stock": 5,
            "category_ids": [],
            "active": True,
        },
    )
    assert create_res.status_code == 201
    prod_id = create_res.json()["id"]

    kardex_res = client.get(f"/api/products/{prod_id}/kardex")
    assert kardex_res.status_code == 200
    movements = kardex_res.json()
    assert len(movements) == 1
    assert movements[0]["movement_type"] == "INICIAL"
    assert movements[0]["quantity"] == 25
    assert movements[0]["previous_stock"] == 0
    assert movements[0]["current_stock"] == 25


def test_stock_adjustment_set_and_add(client: TestClient) -> None:
    create_res = client.post(
        "/api/products/",
        json={
            "name": "Arroz Largo Fino 1kg",
            "price": 900.0,
            "cost_price": 500.0,
            "stock": 10,
            "min_stock": 3,
            "category_ids": [],
            "active": True,
        },
    )
    prod_id = create_res.json()["id"]

    # 1. Negative adjustment (ROTURA / MERMA)
    adj1 = client.post(
        f"/api/products/{prod_id}/adjust-stock",
        json={
            "adjustment_type": "ADD",
            "quantity": -2,
            "reason": "ROTURA",
            "notes": "Paquetes rotos en estantería",
        },
    )
    assert adj1.status_code == 200
    assert adj1.json()["product"]["stock"] == 8

    # 2. Absolute adjustment (SET by physical inventory count)
    adj2 = client.post(
        f"/api/products/{prod_id}/adjust-stock",
        json={
            "adjustment_type": "SET",
            "quantity": 14,
            "reason": "RECUENTO",
            "notes": "Auditoría de inventario físico",
        },
    )
    assert adj2.status_code == 200
    assert adj2.json()["product"]["stock"] == 14

    # Verify Kardex trail
    kardex_res = client.get(f"/api/products/{prod_id}/kardex")
    movements = kardex_res.json()
    assert len(movements) == 3
    # Newest first
    assert movements[0]["movement_type"] == "RECUENTO"
    assert movements[0]["quantity"] == 6
    assert movements[0]["previous_stock"] == 8
    assert movements[0]["current_stock"] == 14

    assert movements[1]["movement_type"] == "ROTURA"
    assert movements[1]["quantity"] == -2
    assert movements[1]["previous_stock"] == 10
    assert movements[1]["current_stock"] == 8

    # Global movements list
    all_movs_res = client.get("/api/products/stock-movements")
    assert all_movs_res.status_code == 200
    assert any(m["id"] == movements[0]["id"] for m in all_movs_res.json())


def test_sales_and_purchases_feed_kardex_and_profitability_report(
    client: TestClient,
    db_session: Session,
) -> None:
    supplier = Supplier(name="Mayorista Sur")
    test_client = Client(name="Consumidor Regular", dni="11223344")
    db_session.add_all([supplier, test_client])
    db_session.commit()

    # Create product with 0 stock
    prod_res = client.post(
        "/api/products/",
        json={
            "name": "Yerba Mate 1kg",
            "price": 2000.0,
            "cost_price": 1200.0,
            "stock": 0,
            "min_stock": 2,
            "category_ids": [],
            "active": True,
        },
    )
    prod_id = prod_res.json()["id"]

    # 1. Purchase 10 units at 1200 cost
    pur_res = client.post(
        "/api/purchases/",
        json={
            "supplier_id": supplier.id,
            "invoice_number": "FC-098",
            "status": PURCHASE_STATUS_PAID,
            "items": [
                {
                    "product_id": prod_id,
                    "quantity": 10,
                    "unit_cost": 1200.0,
                }
            ],
            "payment": {
                "amount": 12000.0,
                "payment_method": 0,
            },
        },
    )
    assert pur_res.status_code == 201

    # 2. Sell 4 units at 2000 (total = 8000)
    sale_res = client.post(
        "/api/sales/",
        json={
            "client_id": test_client.id,
            "status": SALE_STATUS_PAID,
            "items": [
                {
                    "product_id": prod_id,
                    "quantity": 4,
                    "discount_rate": 0.0,
                }
            ],
            "payment": {
                "amount": 8000.0,
                "payment_method": 0,
            },
        },
    )
    assert sale_res.status_code == 201

    # Product stock should now be 6
    p_get = client.get(f"/api/products/{prod_id}")
    assert p_get.json()["stock"] == 6

    # Kardex should have: VENTA (-4), COMPRA (+10)
    kardex_res = client.get(f"/api/products/{prod_id}/kardex")
    movs = kardex_res.json()
    assert len(movs) == 2
    assert movs[0]["movement_type"] == "VENTA"
    assert movs[0]["quantity"] == -4
    assert movs[0]["previous_stock"] == 10
    assert movs[0]["current_stock"] == 6

    assert movs[1]["movement_type"] == "COMPRA"
    assert movs[1]["quantity"] == 10
    assert movs[1]["previous_stock"] == 0
    assert movs[1]["current_stock"] == 10

    # 3. Test Profitability Report
    rep_res = client.get("/api/reports/profitability?period=all")
    assert rep_res.status_code == 200
    report = rep_res.json()

    assert report["total_sales_revenue"] == 8000.0
    assert report["total_cost_of_sales"] == 4800.0  # 4 * 1200
    assert report["gross_profit"] == 3200.0  # 8000 - 4800
    assert report["profit_margin_percent"] == 40.0  # (3200 / 8000) * 100
    assert report["total_purchases_expense"] == 12000.0
    assert report["inventory_cost_value"] == 7200.0  # 6 * 1200
    assert report["inventory_sale_value"] == 12000.0  # 6 * 2000
    assert report["potential_inventory_profit"] == 4800.0

    # Top selling & profitable rankings
    assert len(report["top_selling_products"]) == 1
    assert report["top_selling_products"][0]["quantity_sold"] == 4
    assert report["top_profitable_products"][0]["gross_profit"] == 3200.0
