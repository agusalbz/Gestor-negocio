from sqlalchemy.orm import Session

from app.models.client import Client
from app.repositories.clients import ClientRepository
from app.schemas.client import ClientCreate, ClientUpdate
from app.services.catalog import _normalize_name


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


class ClientService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = ClientRepository(db)

    def _calculate_client_debt(self, client: Client) -> float:
        total_debt = 0.0
        for sale in client.sales:
            total = float(sale.total_amount)
            paid = sum(float(p.amount) for p in sale.payments)
            balance = total - paid
            if balance > 0.009:
                total_debt += balance
        return round(total_debt, 2)

    def list_clients(self, *, search: str | None = None, include_inactive: bool = False) -> list[dict]:
        clients = self.repository.list(search=search, include_inactive=include_inactive)
        result = []
        for client in clients:
            debt = self._calculate_client_debt(client)
            result.append(
                {
                    "id": client.id,
                    "dni": client.dni,
                    "name": client.name,
                    "phone": client.phone,
                    "active": client.active,
                    "total_debt": debt,
                }
            )
        return result

    def get_client(self, client_id: int) -> Client:
        client = self.repository.get_by_id(client_id)
        if client is None:
            raise LookupError("Cliente no encontrado")
        return client

    def get_client_read(self, client_id: int) -> dict:
        client = self.get_client(client_id)
        debt = self._calculate_client_debt(client)
        return {
            "id": client.id,
            "dni": client.dni,
            "name": client.name,
            "phone": client.phone,
            "active": client.active,
            "total_debt": debt,
        }

    def get_client_account(self, client_id: int) -> dict:
        client = self.get_client(client_id)
        pending_sales = []
        payments_history = []
        total_debt = 0.0

        for sale in sorted(client.sales, key=lambda s: s.sold_at):
            total = float(sale.total_amount)
            paid = sum(float(p.amount) for p in sale.payments)
            balance = round(total - paid, 2)
            if balance > 0.009:
                total_debt += balance
                pending_sales.append(
                    {
                        "sale_id": sale.id,
                        "sold_at": sale.sold_at,
                        "total_amount": total,
                        "total_paid": paid,
                        "balance": balance,
                    }
                )
            for p in sale.payments:
                payments_history.append(
                    {
                        "id": p.id,
                        "sale_id": sale.id,
                        "amount": float(p.amount),
                        "payment_method": p.payment_method,
                        "paid_at": p.paid_at,
                    }
                )

        payments_history.sort(key=lambda p: p["paid_at"], reverse=True)

        client_read = {
            "id": client.id,
            "dni": client.dni,
            "name": client.name,
            "phone": client.phone,
            "active": client.active,
            "total_debt": round(total_debt, 2),
        }

        return {
            "client": client_read,
            "total_debt": round(total_debt, 2),
            "pending_sales": pending_sales,
            "recent_payments": payments_history,
        }

    def register_client_payment(self, client_id: int, payload: object) -> dict:
        from app.services.sales import SaleService

        client = self.get_client(client_id)
        amount = getattr(payload, "amount", 0.0)
        payment_method = getattr(payload, "payment_method", 0)
        sale_id = getattr(payload, "sale_id", None)

        if amount <= 0:
            raise ValueError("El monto debe ser mayor a 0")

        sales_service = SaleService(self.db)
        remaining = float(amount)

        if sale_id is not None:
            sale = sales_service.sales.get_by_id(sale_id)
            if sale is None or sale.client_id != client.id:
                raise ValueError("Venta no encontrada para este cliente")
            summary = sales_service._build_summary(sale)
            if summary["balance"] <= 0:
                raise ValueError("La venta ya se encuentra saldada")
            pay_amount = min(remaining, summary["balance"])
            sales_service._register_payment(sale, pay_amount, payment_method)
        else:
            # Distribute FIFO across pending sales
            pending_sales = []
            for s in sorted(client.sales, key=lambda x: x.sold_at):
                summary = sales_service._build_summary(s)
                if summary["balance"] > 0.009:
                    pending_sales.append((s, summary["balance"]))

            if not pending_sales:
                raise ValueError("El cliente no posee deuda pendiente")

            for s, bal in pending_sales:
                if remaining <= 0:
                    break
                chunk = min(remaining, bal)
                sales_service._register_payment(s, chunk, payment_method)
                remaining -= chunk

        self.db.commit()
        return self.get_client_account(client.id)

    def create_client(self, payload: ClientCreate) -> Client:
        dni = _normalize_optional_text(payload.dni)
        if dni and self.repository.get_by_dni(dni):
            raise ValueError("Ya existe un cliente con ese DNI")

        client = Client(
            dni=dni,
            name=_normalize_name(payload.name),
            phone=_normalize_optional_text(payload.phone),
            active=payload.active,
        )
        self.repository.create(client)
        self.db.commit()
        return client

    def update_client(self, client_id: int, payload: ClientUpdate) -> Client:
        client = self.get_client(client_id)

        if payload.dni is not None:
            dni = _normalize_optional_text(payload.dni)
            if dni:
                existing = self.repository.get_by_dni(dni)
                if existing and existing.id != client.id:
                    raise ValueError("Ya existe un cliente con ese DNI")
            client.dni = dni

        if payload.name is not None:
            client.name = _normalize_name(payload.name)
        if payload.phone is not None:
            client.phone = _normalize_optional_text(payload.phone)
        if payload.active is not None:
            client.active = payload.active

        self.db.commit()
        self.db.refresh(client)
        return client

    def delete_client(self, client_id: int) -> None:
        client = self.get_client(client_id)
        client.active = False
        self.db.commit()
