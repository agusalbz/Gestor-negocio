from datetime import datetime

from sqlalchemy.orm import Session

from app.core.constants import (
    CASH_MOVEMENT_IN,
    PAYMENT_METHOD_CASH,
    PAYMENT_METHOD_CREDIT,
    PAYMENT_METHOD_DEBIT,
    PAYMENT_METHOD_QR,
    PAYMENT_METHOD_TRANSFER,
)
from app.models.cash_closing import CashClosing
from app.models.cash_movement import CashMovement
from app.repositories.cash import CashRepository
from app.schemas.cash import CashCloseRequest, CashMovementCreate, CashOpenRequest


class CashService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = CashRepository(db)

    def get_status(self) -> dict:
        session = self.repository.get_active_session()
        if session is None:
            return {
                "is_open": False,
                "active_session_id": None,
                "opened_at": None,
                "opening_cash": 0.0,
                "cash_sales": 0.0,
                "debit_sales": 0.0,
                "credit_sales": 0.0,
                "transfer_sales": 0.0,
                "manual_in": 0.0,
                "manual_out": 0.0,
                "expected_cash": 0.0,
                "total_sales": 0.0,
            }

        movements = self.repository.get_movements_since(session.opened_at)
        cash_sales = 0.0
        debit_sales = 0.0
        credit_sales = 0.0
        transfer_sales = 0.0
        manual_in = 0.0
        manual_out = 0.0

        for m in movements:
            amount = float(m.amount)
            if m.sale_id is not None:
                if m.payment_method == PAYMENT_METHOD_CASH:
                    cash_sales += amount
                elif m.payment_method == PAYMENT_METHOD_DEBIT:
                    debit_sales += amount
                elif m.payment_method == PAYMENT_METHOD_CREDIT:
                    credit_sales += amount
                elif m.payment_method in (PAYMENT_METHOD_TRANSFER, PAYMENT_METHOD_QR):
                    transfer_sales += amount
            else:
                if m.movement_type == CASH_MOVEMENT_IN:
                    manual_in += amount
                else:
                    manual_out += amount

        opening_cash = float(session.opening_cash)
        expected_cash = opening_cash + cash_sales + manual_in - manual_out
        total_sales = cash_sales + debit_sales + credit_sales + transfer_sales

        return {
            "is_open": True,
            "active_session_id": session.id,
            "opened_at": session.opened_at,
            "opening_cash": opening_cash,
            "cash_sales": round(cash_sales, 2),
            "debit_sales": round(debit_sales, 2),
            "credit_sales": round(credit_sales, 2),
            "transfer_sales": round(transfer_sales, 2),
            "manual_in": round(manual_in, 2),
            "manual_out": round(manual_out, 2),
            "expected_cash": round(expected_cash, 2),
            "total_sales": round(total_sales, 2),
        }

    def open_caja(self, payload: CashOpenRequest) -> CashClosing:
        active = self.repository.get_active_session()
        if active is not None:
            raise ValueError("Ya existe una caja abierta en curso")

        closing = CashClosing(
            opened_at=datetime.utcnow(),
            opening_cash=payload.opening_cash,
            is_closed=False,
        )
        self.repository.create_closing(closing)
        self.db.commit()
        return closing

    def close_caja(self, payload: CashCloseRequest) -> CashClosing:
        session = self.repository.get_active_session()
        if session is None:
            raise ValueError("No hay ninguna caja abierta para cerrar")

        status = self.get_status()
        counted = float(payload.counted_cash)
        expected = float(status["expected_cash"])
        diff = counted - expected

        session.closed_at = datetime.utcnow()
        session.cash_sales = status["cash_sales"]
        session.debit_sales = status["debit_sales"]
        session.credit_sales = status["credit_sales"]
        session.transfer_sales = status["transfer_sales"]
        session.manual_in = status["manual_in"]
        session.manual_out = status["manual_out"]
        session.expected_cash = expected
        session.counted_cash = counted
        session.difference = round(diff, 2)
        session.notes = payload.notes
        session.is_closed = True

        self.db.commit()
        self.db.refresh(session)
        return session

    def create_movement(self, payload: CashMovementCreate) -> CashMovement:
        movement = CashMovement(
            moved_at=datetime.utcnow(),
            amount=payload.amount,
            movement_type=payload.movement_type,
            payment_method=payload.payment_method,
            concept=payload.concept.strip(),
            sale_id=None,
        )
        self.repository.create_movement(movement)
        self.db.commit()
        return movement

    def list_closings(self, limit: int = 50) -> list[CashClosing]:
        return self.repository.list_closings(limit=limit)

    def list_movements(self, limit: int = 100) -> list[CashMovement]:
        return self.repository.list_movements(limit=limit)
