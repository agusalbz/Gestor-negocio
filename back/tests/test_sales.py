from fastapi.testclient import TestClient


def _create_product(client: TestClient, *, name: str, price: float, stock: int) -> int:
    response = client.post(
        "/api/products",
        json={
            "name": name,
            "price": price,
            "stock": stock,
            "active": True,
            "category_ids": [],
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_create_credit_sale_reduces_stock_and_leaves_balance(client: TestClient) -> None:
    product_id = _create_product(client, name="Notebook", price=1000, stock=4)

    response = client.post(
        "/api/sales",
        json={
            "status": 0,
            "items": [{"product_id": product_id, "quantity": 2}],
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == 0
    assert payload["summary"]["total_amount"] == 2000.0
    assert payload["summary"]["total_paid"] == 0.0
    assert payload["summary"]["balance"] == 2000.0

    product_response = client.get(f"/api/products/{product_id}")
    assert product_response.status_code == 200
    assert product_response.json()["stock"] == 2


def test_create_partial_sale_registers_payment_and_cash_movement(client: TestClient) -> None:
    product_id = _create_product(client, name="Mouse", price=500, stock=10)

    response = client.post(
        "/api/sales",
        json={
            "status": 1,
            "items": [{"product_id": product_id, "quantity": 3}],
            "payment": {"amount": 700, "payment_method": 0},
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == 1
    assert payload["summary"]["total_amount"] == 1500.0
    assert payload["summary"]["total_paid"] == 700.0
    assert payload["summary"]["balance"] == 800.0
    assert len(payload["payments"]) == 1


def test_create_paid_sale_with_client_data_creates_or_reuses_client(client: TestClient) -> None:
    product_id = _create_product(client, name="Teclado", price=200, stock=5)

    response = client.post(
        "/api/sales",
        json={
            "status": 2,
            "items": [{"product_id": product_id, "quantity": 2}],
            "client": {"dni": "30111222", "name": "Ana Gomez", "phone": "1133445566"},
            "payment": {"payment_method": 1},
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == 2
    assert payload["summary"]["balance"] == 0.0
    assert payload["client"]["dni"] == "30111222"
    assert len(payload["payments"]) == 1

    clients_response = client.get("/api/clients")
    assert clients_response.status_code == 200
    assert len(clients_response.json()) == 1


def test_register_payment_on_existing_sale_updates_status_to_paid(client: TestClient) -> None:
    product_id = _create_product(client, name="Monitor", price=750, stock=3)
    sale_response = client.post(
        "/api/sales",
        json={
            "status": 0,
            "items": [{"product_id": product_id, "quantity": 2}],
        },
    )
    sale_id = sale_response.json()["id"]

    payment_response = client.post(
        f"/api/sales/{sale_id}/payments",
        json={"payment_method": 2},
    )

    assert payment_response.status_code == 200
    payload = payment_response.json()
    assert payload["status"] == 2
    assert payload["summary"]["total_paid"] == 1500.0
    assert payload["summary"]["balance"] == 0.0
    assert len(payload["payments"]) == 1


def test_create_sale_fails_on_insufficient_stock(client: TestClient) -> None:
    product_id = _create_product(client, name="Impresora", price=900, stock=1)

    response = client.post(
        "/api/sales",
        json={
            "status": 0,
            "items": [{"product_id": product_id, "quantity": 5}],
        },
    )

    assert response.status_code == 400
    assert "Stock insuficiente" in response.json()["detail"]


def test_create_sale_with_discount_and_payment_method(client: TestClient) -> None:
    product_id = _create_product(client, name="Auriculares", price=1000, stock=5)

    # 10% discount on 2 units = 2000 - 200 = 1800
    response = client.post(
        "/api/sales",
        json={
            "status": 2,
            "items": [{"product_id": product_id, "quantity": 2, "discount_rate": 10}],
            "payment": {"amount": 1800, "payment_method": 1},
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["total_amount"] == 1800.0
    assert payload["items"][0]["discount_rate"] == 10.0
    assert payload["items"][0]["subtotal"] == 1800.0
    assert payload["payments"][0]["payment_method"] == 1

