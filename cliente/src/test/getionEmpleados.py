from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Literal, List

from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr, Field, ConfigDict, constr
from sqlalchemy import create_engine, String, Integer, DateTime, func, Boolean, select, Index, UniqueConstraint
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Mapped, mapped_column, Session
from passlib.context import CryptContext
from jose import jwt, JWTError

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./employees.db")
JWT_SECRET = os.getenv("JWT_SECRET", "CHANGE_ME_TO_A_LONG_RANDOM_SECRET")
JWT_ALG = os.getenv("JWT_ALG", "HS256")
ACCESS_TOKEN_EXPIRE_MIN = int(os.getenv("ACCESS_TOKEN_EXPIRE_MIN", "30"))
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def hash_password(p: str) -> str:
    return pwd_context.hash(p)

def verify_password(p: str, hp: str) -> bool:
    return pwd_context.verify(p, hp)

def create_access_token(subject: str, role: str, expires_minutes: Optional[int] = None) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes or ACCESS_TOKEN_EXPIRE_MIN)
    return jwt.encode({"sub": subject, "role": role, "exp": exp}, JWT_SECRET, algorithm=JWT_ALG)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError as e:
        raise ValueError("Invalid token") from e

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="user", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Employee(Base):
    __tablename__ = "employees"
    __table_args__ = (UniqueConstraint("employee_code", name="uq_employee_code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_code: Mapped[str] = mapped_column(String(20), nullable=False)
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    last_name: Mapped[str] = mapped_column(String(80), nullable=False)
    email: Mapped[str] = mapped_column(String(254), index=True, nullable=False)
    department: Mapped[str] = mapped_column(String(80), nullable=False)
    position: Mapped[str] = mapped_column(String(80), nullable=False)
    salary_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

Index("ix_employees_dept_active", Employee.department, Employee.is_active)

class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    role: Optional[Literal["user", "admin"]] = "user"

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    role: str
    is_active: bool

CodeStr = constr(strip_whitespace=True, min_length=3, max_length=20, pattern=r"^[A-Za-z0-9_-]+$")
NameStr = constr(strip_whitespace=True, min_length=1, max_length=80)
DeptStr = constr(strip_whitespace=True, min_length=2, max_length=80)
PosStr = constr(strip_whitespace=True, min_length=2, max_length=80)

class EmployeeCreate(BaseModel):
    employee_code: CodeStr
    first_name: NameStr
    last_name: NameStr
    email: EmailStr
    department: DeptStr
    position: PosStr
    salary_cents: int = Field(ge=0, le=10_000_000_00)
    is_active: bool = True

class EmployeeUpdate(BaseModel):
    first_name: Optional[NameStr] = None
    last_name: Optional[NameStr] = None
    email: Optional[EmailStr] = None
    department: Optional[DeptStr] = None
    position: Optional[PosStr] = None
    salary_cents: Optional[int] = Field(default=None, ge=0, le=10_000_000_00)
    is_active: Optional[bool] = None

class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_code: str
    first_name: str
    last_name: str
    email: EmailStr
    department: str
    position: str
    salary_cents: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    try:
        payload = decode_token(token)
        email = payload.get("sub")
        if not email:
            raise ValueError("Missing sub")
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    user = db.scalar(select(User).where(User.email == email))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no válido/inactivo")
    return user

def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Requiere rol admin")
    return user

def clamp_limit(limit: int) -> int:
    return min(max(limit, 1), 100)

def clamp_skip(skip: int) -> int:
    return max(skip, 0)

app = FastAPI(title="Employee Management (Secure)")

@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Referrer-Policy"] = "no-referrer"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    resp.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    resp.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return resp

@app.exception_handler(Exception)
async def safe_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": "INTERNAL_ERROR"})

Base.metadata.create_all(bind=engine)

def ensure_admin_seed():
    email = os.getenv("ADMIN_EMAIL")
    pwd = os.getenv("ADMIN_PASSWORD")
    if not email or not pwd:
        return
    db = SessionLocal()
    try:
        existing = db.scalar(select(User).where(User.email == email))
        if not existing:
            db.add(User(email=email, hashed_password=hash_password(pwd), role="admin", is_active=True))
            db.commit()
    finally:
        db.close()

ensure_admin_seed()

@app.post("/auth/register", response_model=UserOut, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=409, detail="Email ya registrado")
    role = payload.role or "user"
    user = User(email=payload.email, hashed_password=hash_password(payload.password), role=role, is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@app.post("/auth/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuario inactivo")
    return TokenOut(access_token=create_access_token(subject=user.email, role=user.role))

@app.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user

@app.get("/employees", response_model=List[EmployeeOut])
def list_employees(
    search: Optional[str] = None,
    department: Optional[str] = None,
    is_active: Optional[bool] = None,
    sort: Literal["id", "employee_code", "first_name", "last_name", "email", "department", "position", "created_at"] = "id",
    dir: Literal["asc", "desc"] = "desc",
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    limit = clamp_limit(limit)
    skip = clamp_skip(skip)
    allowed_sort = {
        "id": Employee.id,
        "employee_code": Employee.employee_code,
        "first_name": Employee.first_name,
        "last_name": Employee.last_name,
        "email": Employee.email,
        "department": Employee.department,
        "position": Employee.position,
        "created_at": Employee.created_at,
    }
    order_col = allowed_sort[sort]
    order_col = order_col.asc() if dir == "asc" else order_col.desc()

    q = select(Employee)
    if search:
        s = f"%{search.strip()}%"
        q = q.where(
            (Employee.employee_code.ilike(s))
            | (Employee.first_name.ilike(s))
            | (Employee.last_name.ilike(s))
            | (Employee.email.ilike(s))
        )
    if department:
        q = q.where(Employee.department == department.strip())
    if is_active is not None:
        q = q.where(Employee.is_active == is_active)

    q = q.order_by(order_col).offset(skip).limit(limit)
    return db.scalars(q).all()

@app.get("/employees/{employee_id}", response_model=EmployeeOut)
def get_employee(employee_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    emp = db.get(Employee, employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return emp

@app.post("/employees", response_model=EmployeeOut, status_code=201)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if db.scalar(select(Employee).where(Employee.employee_code == payload.employee_code)):
        raise HTTPException(status_code=409, detail="employee_code ya existe")
    emp = Employee(
        employee_code=payload.employee_code,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=str(payload.email),
        department=payload.department,
        position=payload.position,
        salary_cents=payload.salary_cents,
        is_active=payload.is_active,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp

@app.patch("/employees/{employee_id}", response_model=EmployeeOut)
def update_employee(employee_id: int, payload: EmployeeUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    emp = db.get(Employee, employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    if payload.first_name is not None:
        emp.first_name = payload.first_name
    if payload.last_name is not None:
        emp.last_name = payload.last_name
    if payload.email is not None:
        emp.email = str(payload.email)
    if payload.department is not None:
        emp.department = payload.department
    if payload.position is not None:
        emp.position = payload.position
    if payload.salary_cents is not None:
        emp.salary_cents = payload.salary_cents
    if payload.is_active is not None:
        emp.is_active = payload.is_active

    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp

@app.delete("/employees/{employee_id}", status_code=204)
def delete_employee(employee_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    emp = db.get(Employee, employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    db.delete(emp)
    db.commit()
    return None

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("empleados_seguro:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=False)
