from fastapi.testclient import TestClient


def test_create_and_list_categories(client: TestClient) -> None:
    create_response = client.post("/api/categories", json={"name": "Ropa"})
    assert create_response.status_code == 201
    assert create_response.json()["name"] == "Ropa"

    list_response = client.get("/api/categories")
    assert list_response.status_code == 200
    payload = list_response.json()
    assert len(payload) == 1
    assert payload[0]["name"] == "Ropa"


def test_create_product_with_categories_and_filter_by_category(client: TestClient) -> None:
    category_response = client.post("/api/categories", json={"name": "Calzado"})
    category_id = category_response.json()["id"]

    product_response = client.post(
        "/api/products",
        json={
            "name": "Zapatilla Urbana",
            "price": 55999.9,
            "stock": 8,
            "active": True,
            "category_ids": [category_id],
        },
    )
    assert product_response.status_code == 201
    assert product_response.json()["categories"][0]["name"] == "Calzado"

    filtered_response = client.get(f"/api/products?category_id={category_id}")
    assert filtered_response.status_code == 200
    payload = filtered_response.json()
    assert len(payload) == 1
    assert payload[0]["name"] == "Zapatilla Urbana"


def test_soft_delete_product_hides_it_from_default_listing(client: TestClient) -> None:
    create_response = client.post(
        "/api/products",
        json={
            "name": "Campera",
            "price": 89999,
            "stock": 3,
            "active": True,
            "category_ids": [],
        },
    )
    product_id = create_response.json()["id"]

    delete_response = client.delete(f"/api/products/{product_id}")
    assert delete_response.status_code == 204

    list_response = client.get("/api/products")
    assert list_response.status_code == 200
    assert list_response.json() == []

    include_inactive_response = client.get("/api/products?include_inactive=true")
    assert include_inactive_response.status_code == 200
    assert len(include_inactive_response.json()) == 1
    assert include_inactive_response.json()[0]["active"] is False


def test_search_product_by_sku_and_barcode(client: TestClient) -> None:
    client.post(
        "/api/products",
        json={
            "name": "Yerba Mate",
            "price": 3500,
            "stock": 20,
            "sku": "YERBA-01",
            "barcode": "7790011223344",
            "active": True,
            "category_ids": [],
        },
    )

    # Search by SKU
    sku_res = client.get("/api/products?search=YERBA-01")
    assert sku_res.status_code == 200
    assert len(sku_res.json()) == 1
    assert sku_res.json()[0]["name"] == "Yerba Mate"

    # Search by Barcode
    barcode_res = client.get("/api/products?search=7790011223344")
    assert barcode_res.status_code == 200
    assert len(barcode_res.json()) == 1
    assert barcode_res.json()[0]["sku"] == "YERBA-01"

