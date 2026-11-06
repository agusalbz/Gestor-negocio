from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class StockMovementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_name: str | None = None
    product_sku: str | None = None
    movement_type: str
    quantity: int
    previous_stock: int
    current_stock: int
    reference_id: int | None = None
    reference_type: str | None = None
    notes: str | None = None
    created_at: datetime


class StockAdjustmentCreate(BaseModel):
    adjustment_type: str = Field("SET", description="SET para fijar stock total, ADD para sumar/restar unidades")
    quantity: int = Field(..., description="Nuevo stock (si SET) o cantidad delta (si ADD)")
    reason: str = Field("RECUENTO", description="RECUENTO, ROTURA, MERMA, DEVOLUCION, AJUSTE_INGRESO, AJUSTE_EGRESO")
    notes: str | None = Field(None, max_length=255, description="Observaciones del ajuste")
