from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.product import Product
from app.models.stock_movement import StockMovement
from app.repositories.catalog import CategoryRepository, ProductRepository
from app.repositories.stock_movements import StockMovementRepository
from app.schemas.category import CategoryCreate, CategoryUpdate
from app.schemas.product import ProductCreate, ProductUpdate
from app.schemas.stock_movement import StockAdjustmentCreate


def _normalize_name(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("El nombre no puede estar vacio")
    return normalized


class CategoryService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = CategoryRepository(db)

    def list_categories(self) -> list[Category]:
        return self.repository.list()

    def create_category(self, payload: CategoryCreate) -> Category:
        name = _normalize_name(payload.name)
        if self.repository.get_by_name(name):
            raise ValueError("La categoria ya existe")

        category = Category(name=name)
        self.repository.create(category)
        self.db.commit()
        return category

    def update_category(self, category_id: int, payload: CategoryUpdate) -> Category:
        category = self.repository.get_by_id(category_id)
        if category is None:
            raise LookupError("Categoria no encontrada")

        name = _normalize_name(payload.name)
        existing = self.repository.get_by_name(name)
        if existing and existing.id != category.id:
            raise ValueError("La categoria ya existe")

        category.name = name
        self.db.commit()
        self.db.refresh(category)
        return category

    def delete_category(self, category_id: int) -> None:
        category = self.repository.get_by_id(category_id)
        if category is None:
            raise LookupError("Categoria no encontrada")
        if category.products:
            raise ValueError("No se puede eliminar una categoria con productos asociados")

        self.repository.delete(category)
        self.db.commit()


class ProductService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = ProductRepository(db)
        self.category_repository = CategoryRepository(db)
        self.stock_movement_repository = StockMovementRepository(db)

    def list_products(
        self,
        *,
        search: str | None = None,
        category_id: int | None = None,
        include_inactive: bool = False,
    ) -> list[Product]:
        return self.repository.list(
            search=search,
            category_id=category_id,
            include_inactive=include_inactive,
        )

    def get_product(self, product_id: int) -> Product:
        product = self.repository.get_by_id(product_id)
        if product is None:
            raise LookupError("Producto no encontrado")
        return product

    def create_product(self, payload: ProductCreate) -> Product:
        name = _normalize_name(payload.name)
        if self.repository.get_by_name(name):
            raise ValueError("Ya existe un producto con ese nombre")

        categories = self._resolve_categories(payload.category_ids)
        sku = payload.sku.strip() if payload.sku and payload.sku.strip() else None
        barcode = payload.barcode.strip() if payload.barcode and payload.barcode.strip() else None

        product = Product(
            name=name,
            price=payload.price,
            cost_price=payload.cost_price,
            stock=payload.stock,
            min_stock=payload.min_stock,
            sku=sku,
            barcode=barcode,
            active=payload.active,
            categories=categories,
        )

        self.repository.create(product)
        if product.stock > 0:
            initial_movement = StockMovement(
                product_id=product.id,
                movement_type="INICIAL",
                quantity=product.stock,
                previous_stock=0,
                current_stock=product.stock,
                reference_type="initial",
                notes="Carga inicial de producto al crear",
            )
            self.db.add(initial_movement)
        self.db.commit()
        return self.get_product(product.id)

    def update_product(self, product_id: int, payload: ProductUpdate) -> Product:
        product = self.get_product(product_id)

        if payload.name is not None:
            name = _normalize_name(payload.name)
            existing = self.repository.get_by_name(name)
            if existing and existing.id != product.id:
                raise ValueError("Ya existe un producto con ese nombre")
            product.name = name

        if payload.price is not None:
            product.price = payload.price
        if payload.cost_price is not None:
            product.cost_price = payload.cost_price
        if payload.stock is not None:
            product.stock = payload.stock
        if payload.min_stock is not None:
            product.min_stock = payload.min_stock
        if payload.sku is not None:
            product.sku = payload.sku.strip() if payload.sku.strip() else None
        if payload.barcode is not None:
            product.barcode = payload.barcode.strip() if payload.barcode.strip() else None
        if payload.active is not None:
            product.active = payload.active
        if payload.category_ids is not None:
            product.categories = self._resolve_categories(payload.category_ids)

        self.db.commit()
        self.db.refresh(product)
        return self.get_product(product.id)

    def delete_product(self, product_id: int) -> None:
        product = self.get_product(product_id)
        product.active = False
        self.db.commit()

    def _resolve_categories(self, category_ids: list[int]) -> list[Category]:
        categories: list[Category] = []
        seen: set[int] = set()

        for category_id in category_ids:
            if category_id in seen:
                continue
            seen.add(category_id)
            category = self.category_repository.get_by_id(category_id)
            if category is None:
                raise ValueError(f"Categoria no encontrada: {category_id}")
            categories.append(category)

        return categories

    def adjust_stock(self, product_id: int, payload: StockAdjustmentCreate) -> dict:
        product = self.get_product(product_id)
        prev_stock = product.stock

        if payload.adjustment_type == "SET":
            if payload.quantity < 0:
                raise ValueError("El stock no puede ser negativo")
            new_stock = payload.quantity
            delta = new_stock - prev_stock
        elif payload.adjustment_type == "ADD":
            new_stock = prev_stock + payload.quantity
            if new_stock < 0:
                raise ValueError(f"El stock resultante no puede ser negativo ({new_stock})")
            delta = payload.quantity
        else:
            raise ValueError(f"Tipo de ajuste no reconocido: {payload.adjustment_type}")

        product.stock = new_stock

        movement = StockMovement(
            product_id=product.id,
            movement_type=payload.reason or "AJUSTE",
            quantity=delta,
            previous_stock=prev_stock,
            current_stock=new_stock,
            reference_type="manual_adjustment",
            notes=payload.notes,
        )
        self.db.add(movement)
        self.db.commit()
        self.db.refresh(product)
        self.db.refresh(movement)

        return {
            "product": product,
            "movement": self._serialize_movement(movement),
        }

    def get_product_kardex(self, product_id: int, limit: int = 100) -> list[dict]:
        self.get_product(product_id)
        movements = self.stock_movement_repository.list_by_product(product_id, limit=limit)
        return [self._serialize_movement(m) for m in movements]

    def list_stock_movements(self, limit: int = 200) -> list[dict]:
        movements = self.stock_movement_repository.list_all(limit=limit)
        return [self._serialize_movement(m) for m in movements]

    def _serialize_movement(self, movement: StockMovement) -> dict:
        return {
            "id": movement.id,
            "product_id": movement.product_id,
            "product_name": movement.product.name if movement.product else None,
            "product_sku": movement.product.sku if movement.product else None,
            "movement_type": movement.movement_type,
            "quantity": movement.quantity,
            "previous_stock": movement.previous_stock,
            "current_stock": movement.current_stock,
            "reference_id": movement.reference_id,
            "reference_type": movement.reference_type,
            "notes": movement.notes,
            "created_at": movement.created_at,
        }
