from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CashOpenRequest(BaseModel):
    opening_cash: float = Field(default=0.0, ge=0)


class CashCloseRequest(BaseModel):
    counted_cash: float = Field(ge=0)
    notes: str | None = Field(default=None, max_length=255)


class CashMovementCreate(BaseModel):
    amount: float = Field(gt=0)
    movement_type: int = Field(ge=0, le=1)  # 0 = IN, 1 = OUT
    payment_method: int = Field(default=0, ge=0, le=3)
    concept: str = Field(min_length=1, max_length=255)


class CashMovementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    moved_at: datetime
    amount: float
    movement_type: int
    payment_method: int
    concept: str
    sale_id: int | None


class CashClosingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    opened_at: datetime
    closed_at: datetime | None
    opening_cash: float
    cash_sales: float
    debit_sales: float
    credit_sales: float
    transfer_sales: float
    manual_in: float
    manual_out: float
    expected_cash: float
    counted_cash: float | None
    difference: float | None
    notes: str | None
    is_closed: bool


class CashStatusRead(BaseModel):
    is_open: bool
    active_session_id: int | None = None
    opened_at: datetime | None = None
    opening_cash: float = 0.0
    cash_sales: float = 0.0
    debit_sales: float = 0.0
    credit_sales: float = 0.0
    transfer_sales: float = 0.0
    manual_in: float = 0.0
    manual_out: float = 0.0
    expected_cash: float = 0.0
    total_sales: float = 0.0
