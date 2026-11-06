from sqlalchemy import create_engine, inspect
from sqlalchemy.pool import StaticPool

from app.db.base import Base
import app.models  # noqa: F401


def test_schema_contains_all_core_tables() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    assert table_names == {
        "cash_closings",
        "cash_movements",
        "categories",
        "clients",
        "product_categories",
        "product_suppliers",
        "products",
        "purchase_items",
        "purchase_payments",
        "purchases",
        "sale_items",
        "sale_payments",
        "sales",
        "stock_movements",
        "suppliers",
    }


def test_schema_contains_expected_foreign_keys() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)

    sales_foreign_keys = inspector.get_foreign_keys("sales")
    assert any(fk["referred_table"] == "clients" for fk in sales_foreign_keys)

    purchases_foreign_keys = inspector.get_foreign_keys("purchases")
    assert any(fk["referred_table"] == "suppliers" for fk in purchases_foreign_keys)

    purchase_items_foreign_keys = inspector.get_foreign_keys("purchase_items")
    assert {fk["referred_table"] for fk in purchase_items_foreign_keys} == {"products", "purchases"}

    purchase_payments_foreign_keys = inspector.get_foreign_keys("purchase_payments")
    assert {fk["referred_table"] for fk in purchase_payments_foreign_keys} == {"purchases"}

    sale_items_foreign_keys = inspector.get_foreign_keys("sale_items")
    assert {fk["referred_table"] for fk in sale_items_foreign_keys} == {"products", "sales"}

    sale_payments_foreign_keys = inspector.get_foreign_keys("sale_payments")
    assert {fk["referred_table"] for fk in sale_payments_foreign_keys} == {"sales"}

    cash_movement_foreign_keys = inspector.get_foreign_keys("cash_movements")
    assert {fk["referred_table"] for fk in cash_movement_foreign_keys} == {"sales", "purchases"}

    product_categories_foreign_keys = inspector.get_foreign_keys("product_categories")
    assert {fk["referred_table"] for fk in product_categories_foreign_keys} == {
        "categories",
        "products",
    }

    product_suppliers_foreign_keys = inspector.get_foreign_keys("product_suppliers")
    assert {fk["referred_table"] for fk in product_suppliers_foreign_keys} == {
        "products",
        "suppliers",
    }

    stock_movements_foreign_keys = inspector.get_foreign_keys("stock_movements")
    assert {fk["referred_table"] for fk in stock_movements_foreign_keys} == {"products"}

