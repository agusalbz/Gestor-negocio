from fastapi.testclient import TestClient


def test_cash_flow(client: TestClient) -> None:
    # 1. Initially cash should be closed
    status_res = client.get("/api/cash/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["is_open"] is False

    # 2. Open cash session with $5,000
    open_res = client.post("/api/cash/open", json={"opening_cash": 5000})
    assert open_res.status_code == 201
    open_data = open_res.json()
    assert open_data["opening_cash"] == 5000.0
    assert open_data["is_closed"] is False

    # 3. Cannot open again while open
    dup_open = client.post("/api/cash/open", json={"opening_cash": 1000})
    assert dup_open.status_code == 400

    # 4. Check status reflects open
    status_res = client.get("/api/cash/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["is_open"] is True
    assert status_data["opening_cash"] == 5000.0
    assert status_data["expected_cash"] == 5000.0

    # 5. Create a product and make a cash sale of $1,000
    prod_res = client.post(
        "/api/products",
        json={
            "name": "Bebida Cola",
            "price": 500,
            "cost_price": 300,
            "stock": 10,
            "min_stock": 2,
            "sku": "COLA-500",
            "barcode": "779123456",
            "active": True,
            "category_ids": [],
        },
    )
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    sale_res = client.post(
        "/api/sales",
        json={
            "status": 2,
            "items": [{"product_id": prod_id, "quantity": 2, "discount_rate": 0}],
            "payment": {"amount": 1000, "payment_method": 0},  # 0 = Efectivo
        },
    )
    assert sale_res.status_code == 201

    # 6. Check status reflects cash sales
    status_res = client.get("/api/cash/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["cash_sales"] == 1000.0
    assert status_data["expected_cash"] == 6000.0  # 5000 + 1000

    # 7. Add a manual expense of $200
    exp_res = client.post(
        "/api/cash/movements",
        json={
            "amount": 200,
            "movement_type": 1,  # 1 = OUT
            "payment_method": 0,
            "concept": "Pago de flete",
        },
    )
    assert exp_res.status_code == 201

    # 8. Check status reflects expense
    status_res = client.get("/api/cash/status")
    status_data = status_res.json()
    assert status_data["manual_out"] == 200.0
    assert status_data["expected_cash"] == 5800.0  # 5000 + 1000 - 200

    # 9. Close cash with counted cash = $5,850 (+$50 sobrante)
    close_res = client.post(
        "/api/cash/close",
        json={
            "counted_cash": 5850,
            "notes": "Arqueo de turno tarde",
        },
    )
    assert close_res.status_code == 200
    close_data = close_res.json()
    assert close_data["is_closed"] is True
    assert close_data["expected_cash"] == 5800.0
    assert close_data["counted_cash"] == 5850.0
    assert close_data["difference"] == 50.0
    assert close_data["notes"] == "Arqueo de turno tarde"

    # 10. Check list of closings
    closings_res = client.get("/api/cash/closings")
    assert closings_res.status_code == 200
    closings = closings_res.json()
    assert len(closings) >= 1
    assert closings[0]["id"] == close_data["id"]

    # 11. Now status should be closed again
    status_res = client.get("/api/cash/status")
    assert status_res.json()["is_open"] is False
