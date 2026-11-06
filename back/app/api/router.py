from fastapi import APIRouter

from app.api.routes import cash, categories, clients, health, modules, products, purchases, reports, sales, suppliers

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(modules.router, prefix="/modules", tags=["modules"])
api_router.include_router(cash.router, prefix="/cash", tags=["cash"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(purchases.router, prefix="/purchases", tags=["purchases"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(sales.router, prefix="/sales", tags=["sales"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
