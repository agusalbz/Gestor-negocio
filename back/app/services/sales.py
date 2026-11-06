from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.constants import (
    CASH_MOVEMENT_IN,
    SALE_STATUS_CREDIT,
    SALE_STATUS_PAID,
    SALE_STATUS_PARTIAL,
)
from app.models.cash_movement import CashMovement
from app.models.client import Client
from app.models.product import Product
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.sale_payment import SalePayment
from app.models.stock_movement import StockMovement
from app.repositories.clients import ClientRepository
from app.repositories.sales import SaleRepository
from app.schemas.sale import SaleCreate, SalePaymentCreate
from app.services.catalog import _normalize_name
from app.services.clients import _normalize_optional_text


def _deduce_sale_status(total: float, paid: float) -> int:
    if paid <= 0:
        return SALE_STATUS_CREDIT
    if paid < total:
        return SALE_STATUS_PARTIAL
    return SALE_STATUS_PAID


class SaleService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.sales = SaleRepository(db)
        self.clients = ClientRepository(db)

    def list_sales(self, *, pending_only: bool = False) -> list[dict]:
        sales = self.sales.list(pending_only=pending_only)
        return [self._serialize_sale(sale) for sale in sales]

    def list_pending_sales(self) -> list[dict]:
        sales = self.sales.list(pending_only=True)
        pending: list[dict] = []
        for sale in sales:
            summary = self._build_summary(sale)
            client_label = "Sin cliente"
            if sale.client is not None:
                client_label = sale.client.name
                if sale.client.dni:
                    client_label = f"{sale.client.name} ({sale.client.dni})"
            pending.append(
                {
                    "sale_id": sale.id,
                    "client_label": client_label,
                    "balance": summary["balance"],
                }
            )
        return pending

    def get_sale(self, sale_id: int) -> dict:
        sale = self.sales.get_by_id(sale_id)
        if sale is None:
            raise LookupError("Venta no encontrada")
        return self._serialize_sale(sale)

    def create_sale(self, payload: SaleCreate) -> dict:
        try:
            client = self._resolve_client(payload.client_id, payload.client)

            sale_items_payloads: list[dict] = []
            total_amount = 0.0

            for item in payload.items:
                product = self.db.get(Product, item.product_id)
                if product is None or not product.active:
                    raise ValueError("Producto no encontrado o inactivo")
                if item.quantity > product.stock:
                    raise ValueError(f"Stock insuficiente para {product.name}")

                unit_price = float(product.price)
                discount_rate = float(item.discount_rate)
                discount_multiplier = max(0.0, 1.0 - (discount_rate / 100.0))
                subtotal = round(unit_price * item.quantity * discount_multiplier, 2)
                total_amount += subtotal
                sale_items_payloads.append(
                    {
                        "product": product,
                        "product_id": product.id,
                        "quantity": item.quantity,
                        "unit_price": unit_price,
                        "discount_rate": discount_rate,
                        "subtotal": subtotal,
                    }
                )

            sale = Sale(
                total_amount=round(total_amount, 2),
                status=payload.status,
                client=client,
                items=[],
                payments=[],
            )
            self.sales.create(sale)

            for item_data in sale_items_payloads:
                prod = item_data["product"]
                prev_stock = prod.stock
                prod.stock -= item_data["quantity"]
                self.db.add(
                    SaleItem(
                        sale=sale,
                        product_id=item_data["product_id"],
                        quantity=item_data["quantity"],
                        unit_price=item_data["unit_price"],
                        discount_rate=item_data["discount_rate"],
                        subtotal=item_data["subtotal"],
                    )
                )
                self.db.add(
                    StockMovement(
                        product_id=prod.id,
                        movement_type="VENTA",
                        quantity=-item_data["quantity"],
                        previous_stock=prev_stock,
                        current_stock=prod.stock,
                        reference_id=sale.id,
                        reference_type="sale",
                        notes=f"Venta #{sale.id}",
                    )
                )

            if payload.status == SALE_STATUS_CREDIT:
                self.db.commit()
                return self.get_sale(sale.id)

            payment = payload.payment
            assert payment is not None

            if payload.status == SALE_STATUS_PARTIAL:
                if payment.amount is None or payment.amount <= 0:
                    raise ValueError("Monto invalido para pago parcial")
                self._register_payment(sale, payment.amount, payment.payment_method)
            elif payload.status == SALE_STATUS_PAID:
                payment_amount = payment.amount if payment.amount is not None else total_amount
                self._register_payment(sale, payment_amount, payment.payment_method)

            self.db.commit()
            return self.get_sale(sale.id)
        except Exception:
            self.db.rollback()
            raise

    def register_payment(self, sale_id: int, payload: SalePaymentCreate) -> dict:
        sale = self.sales.get_by_id(sale_id)
        if sale is None:
            raise LookupError("Venta no encontrada")

        summary = self._build_summary(sale)
        if summary["balance"] <= 0:
            raise ValueError("La venta ya esta pagada")

        amount = payload.amount if payload.amount is not None else summary["balance"]
        if amount <= 0:
            raise ValueError("El monto debe ser mayor a 0")

        try:
            self._register_payment(sale, amount, payload.payment_method)
            self.db.commit()
            return self.get_sale(sale.id)
        except Exception:
            self.db.rollback()
            raise

    def _resolve_client(self, client_id: int | None, client_payload: object | None) -> Client | None:
        if client_id is not None:
            client = self.clients.get_by_id(client_id)
            if client is None:
                raise ValueError("El cliente no existe")
            return client

        if client_payload is None:
            return None

        dni = _normalize_optional_text(client_payload.dni)
        name = _normalize_optional_text(client_payload.name)
        phone = _normalize_optional_text(client_payload.phone)

        if dni is None:
            return None

        existing = self.clients.get_by_dni(dni)
        if existing is not None:
            return existing

        if not name:
            raise ValueError("El nombre del cliente es obligatorio")

        client = Client(
            dni=dni,
            name=_normalize_name(name),
            phone=phone,
            active=True,
        )
        self.db.add(client)
        self.db.flush()
        return client

    def _register_payment(self, sale: Sale, amount: float, payment_method: int) -> None:
        if amount <= 0:
            raise ValueError("El monto del pago debe ser mayor a 0")

        summary = self._build_summary(sale)
        is_excess = (summary["total_paid"] + amount) > summary["total_amount"]

        payment = SalePayment(
            sale=sale,
            amount=amount,
            payment_method=payment_method,
            is_excess=is_excess,
        )
        self.db.add(payment)

        cash_movement = CashMovement(
            amount=amount,
            movement_type=CASH_MOVEMENT_IN,
            payment_method=payment_method,
            concept=f"Pago venta #{sale.id}",
            sale=sale,
        )
        self.db.add(cash_movement)
        self.db.flush()

        refreshed_summary = self._build_summary(sale)
        sale.status = _deduce_sale_status(refreshed_summary["total_amount"], refreshed_summary["total_paid"])

    def _build_summary(self, sale: Sale) -> dict:
        total_amount = float(sale.total_amount)
        total_paid = float(sum(float(payment.amount) for payment in sale.payments))
        balance = total_amount - total_paid
        return {
            "total_amount": total_amount,
            "total_paid": total_paid,
            "balance": balance,
            "status": _deduce_sale_status(total_amount, total_paid),
        }

    def _serialize_sale(self, sale: Sale) -> dict:
        summary = self._build_summary(sale)
        sale.status = summary["status"]
        return {
            "id": sale.id,
            "sold_at": sale.sold_at,
            "total_amount": float(sale.total_amount),
            "status": sale.status,
            "client": sale.client,
            "items": sale.items,
            "payments": sale.payments,
            "summary": summary,
        }
