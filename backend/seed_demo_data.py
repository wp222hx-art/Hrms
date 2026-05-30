"""
Seed demo data for HRMS Lite.

Idempotent-ish: clears existing employees+attendance, then re-inserts a
realistic-looking synthetic dataset.

Usage:
    cd backend && source venv/bin/activate && python seed_demo_data.py
"""
from __future__ import annotations

import random
from datetime import date, timedelta

from app.database import SessionLocal, Base, engine
from app.models import Employee, Attendance, AttendanceStatus

# Make sure tables exist
Base.metadata.create_all(bind=engine)

# ---- deterministic randomness for reproducible demos ----
random.seed(42)

# ---- synthetic master data ----
DEPARTMENTS = [
    "Engineering",
    "Product",
    "Sales",
    "Finance",
    "Human Resources",
    "IT Support",
]

# (first_name, last_name) — mixed pool, no real PII
FIRST_NAMES = [
    "Alice", "Brian", "Cheryl", "Daniel", "Elaine", "Felix", "Grace", "Henry",
    "Ivy", "Jason", "Karen", "Leon", "Mia", "Nathan", "Olivia", "Patrick",
    "Queenie", "Ryan", "Sophia", "Trevor", "Uma", "Victor", "Wendy", "Xavier",
    "Yvonne", "Zachary", "Aaron", "Bella", "Caleb", "Diana",
]
LAST_NAMES = [
    "Tan", "Lim", "Lee", "Wong", "Ng", "Chan", "Goh", "Teo",
    "Koh", "Chua", "Ong", "Yap", "Sim", "Loh", "Toh",
]


def make_employees(n: int = 30) -> list[dict]:
    """Build n synthetic employees with sensible distribution."""
    employees: list[dict] = []
    used_emails: set[str] = set()
    for i in range(1, n + 1):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        full_name = f"{first} {last}"
        # employee_id like EMP0001
        employee_id = f"EMP{i:04d}"
        # email — disambiguate if duplicate
        base_email = f"{first.lower()}.{last.lower()}"
        email = f"{base_email}@demo-corp.com"
        suffix = 1
        while email in used_emails:
            suffix += 1
            email = f"{base_email}{suffix}@demo-corp.com"
        used_emails.add(email)
        # department weighted: Engineering biggest
        department = random.choices(
            DEPARTMENTS,
            weights=[10, 5, 6, 3, 2, 4],
            k=1,
        )[0]
        employees.append(
            dict(
                employee_id=employee_id,
                full_name=full_name,
                email=email,
                department=department,
            )
        )
    return employees


def make_attendance(employees: list[dict], days_back: int = 30) -> list[dict]:
    """Generate weekday attendance for the last `days_back` days."""
    records: list[dict] = []
    today = date.today()

    # tag a few employees as "frequently absent" to make the dataset interesting
    frequent_absentees = set(random.sample(
        [e["employee_id"] for e in employees],
        k=max(2, len(employees) // 10),
    ))

    for offset in range(days_back, 0, -1):
        d = today - timedelta(days=offset)
        # skip weekends (Sat=5, Sun=6)
        if d.weekday() >= 5:
            continue
        for emp in employees:
            absence_rate = 0.25 if emp["employee_id"] in frequent_absentees else 0.05
            status = (
                AttendanceStatus.ABSENT
                if random.random() < absence_rate
                else AttendanceStatus.PRESENT
            )
            records.append(
                dict(
                    employee_id=emp["employee_id"],
                    date=d,
                    status=status,
                )
            )
    return records


def main() -> None:
    db = SessionLocal()
    try:
        # -- wipe existing demo data (FK: attendance first) --
        deleted_att = db.query(Attendance).delete()
        deleted_emp = db.query(Employee).delete()
        db.commit()
        print(f"Cleared {deleted_emp} employees, {deleted_att} attendance rows.")

        # -- insert employees --
        employees = make_employees(30)
        db.bulk_insert_mappings(Employee, employees)
        db.commit()
        print(f"Inserted {len(employees)} employees.")

        # -- insert attendance --
        records = make_attendance(employees, days_back=30)
        db.bulk_insert_mappings(Attendance, records)
        db.commit()
        print(f"Inserted {len(records)} attendance rows.")

        # -- summary --
        total_emp = db.query(Employee).count()
        total_att = db.query(Attendance).count()
        present = (
            db.query(Attendance)
            .filter(Attendance.status == AttendanceStatus.PRESENT)
            .count()
        )
        absent = total_att - present
        print("---- Summary ----")
        print(f"Employees:           {total_emp}")
        print(f"Attendance records:  {total_att}")
        print(f"  PRESENT:           {present}")
        print(f"  ABSENT:            {absent}")
        print("Sample employees:")
        for emp in db.query(Employee).limit(5).all():
            print(
                f"  {emp.employee_id}  {emp.full_name:<22}  "
                f"{emp.department:<16}  {emp.email}"
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
