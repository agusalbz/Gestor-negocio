from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.schemas.client import (
    ClientAccountRead,
    ClientCreate,
    ClientPaymentCreate,
    ClientRead,
    ClientUpdate,
)
from app.services.clients import ClientService

router = APIRouter()


@router.get("/", response_model=list[ClientRead])
def list_clients(
    search: str | None = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
) -> list[ClientRead]:
    return ClientService(db).list_clients(search=search, include_inactive=include_inactive)


@router.get("/{client_id}", response_model=ClientRead)
def get_client(client_id: int, db: Session = Depends(get_db)) -> ClientRead:
    try:
        return ClientService(db).get_client_read(client_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{client_id}/account", response_model=ClientAccountRead)
def get_client_account(client_id: int, db: Session = Depends(get_db)) -> ClientAccountRead:
    try:
        return ClientService(db).get_client_account(client_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{client_id}/payments", response_model=ClientAccountRead)
def register_client_payment(
    client_id: int,
    payload: ClientPaymentCreate,
    db: Session = Depends(get_db),
) -> ClientAccountRead:
    try:
        return ClientService(db).register_client_payment(client_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/", response_model=ClientRead, status_code=status.HTTP_201_CREATED)
def create_client(payload: ClientCreate, db: Session = Depends(get_db)) -> ClientRead:
    try:
        return ClientService(db).create_client(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.patch("/{client_id}", response_model=ClientRead)
def update_client(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
) -> ClientRead:
    try:
        return ClientService(db).update_client(client_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(client_id: int, db: Session = Depends(get_db)) -> Response:
    try:
        ClientService(db).delete_client(client_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)
