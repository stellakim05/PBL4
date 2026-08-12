from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from database import get_db, engine
from models import UserPreference, Course, User, SavedSchedule, Term
from schemas import PreferenceCreate, PreferenceResponse, CourseResponse, TermCreate, TermResponse, UserCreate, UserLogin, UserResponse, SavedScheduleCreate, SavedScheduleResponse, UserUpdate
import hashlib
from datetime import date

app = FastAPI(
    title="Schedule Planner API", 
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=False,  
    allow_methods=["*"],
    allow_headers=["*"],
)

Term.metadata.create_all(bind=engine)
Course.metadata.create_all(bind=engine)
User.metadata.create_all(bind=engine)
UserPreference.metadata.create_all(bind=engine)
SavedSchedule.metadata.create_all(bind=engine)

@app.get("/")
async def root():
    return {"message": "Schedule Planner API", "version": "1.0.0"}

@app.get("/api/terms")
async def get_terms(db: Session = Depends(get_db)):
    try:
        terms = db.query(Term).order_by(Term.code.desc()).all()
        return [
            {
                "id": term.id,
                "code": term.code,
                "name": term.name,
                "start_date": term.start_date.isoformat() if term.start_date else None,
                "end_date": term.end_date.isoformat() if term.end_date else None,
                "is_active": term.is_active,
                "created_at": term.created_at.isoformat() if term.created_at else None
            }
            for term in terms
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get terms: {str(e)}")

@app.get("/api/terms/active")
async def get_active_term(db: Session = Depends(get_db)):
    try:
        term = db.query(Term).filter(Term.is_active == True).first()
        if not term:
            return None
        return {
            "id": term.id,
            "code": term.code,
            "name": term.name,
            "start_date": term.start_date.isoformat() if term.start_date else None,
            "end_date": term.end_date.isoformat() if term.end_date else None,
            "is_active": term.is_active,
            "created_at": term.created_at.isoformat() if term.created_at else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get active term: {str(e)}")

@app.post("/api/terms")
async def create_term(term: TermCreate, db: Session = Depends(get_db)):
    try:
        db_term = Term(**term.dict())
        db.add(db_term)
        db.commit()
        db.refresh(db_term)
        
        return {
            "id": db_term.id,
            "code": db_term.code,
            "name": db_term.name,
            "start_date": db_term.start_date.isoformat() if db_term.start_date else None,
            "end_date": db_term.end_date.isoformat() if db_term.end_date else None,
            "is_active": db_term.is_active,
            "created_at": db_term.created_at.isoformat() if db_term.created_at else None
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create term: {str(e)}")

@app.post("/api/terms/init")
async def init_terms(db: Session = Depends(get_db)):
    try:
        existing = db.query(Term).first()
        if existing:
            return {"message": "Terms already exist", "count": db.query(Term).count()}
        
        terms_data = [
            {
                "code": "2025S",
                "name": "2025 Spring",
                "start_date": date(2025, 4, 1),
                "end_date": date(2025, 7, 31),
                "is_active": True
            },
           
            {
                "code": "2025F",
                "name": "2025 Fall",
                "start_date": date(2025, 9, 1),
                "end_date": date(2025, 12, 20),
                "is_active": False
            }
        ]
        
        for term_data in terms_data:
            term = Term(**term_data)
            db.add(term)
        
        db.commit()
        return {"message": f"Created {len(terms_data)} terms", "count": len(terms_data)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to init terms: {str(e)}")

# ------------------ Auth: Sign Up / Log In ------------------
def _hash_password(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

@app.post("/api/signup", response_model=UserResponse)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    try:
        existing_by_id = db.query(User).filter(User.user_id == user.user_id).first()
        existing_by_email = db.query(User).filter(User.email == str(user.email)).first()
        
        if existing_by_id and existing_by_email:
            raise HTTPException(status_code=409, detail="User ID and Email already exists")

        if existing_by_id:
            raise HTTPException(status_code=409, detail="User ID already exists")

        if existing_by_email:
            raise HTTPException(status_code=409, detail="Email already exists")

        db_user = User(
            user_id=user.user_id,
            password_hash=_hash_password(user.password),
            email=str(user.email),
            university=user.university or None,
            department=user.department or None,
            grade=user.grade or None,
            term_id=user.term_id or None,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to sign up: {str(e)}")

@app.post("/api/login", response_model=UserResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    try:
        
        user = db.query(User).filter(
            (User.user_id == payload.user_id) | (User.email == payload.user_id)
        ).first()
        if not user:
            
            raise HTTPException(status_code=401, detail="Wrong user id")
        if user.password_hash != _hash_password(payload.password):
            
            raise HTTPException(status_code=401, detail="Wrong password")
        return user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to login: {str(e)}")

@app.put("/api/users/{user_id}", response_model=UserResponse)
def update_user(user_id: str, user_update: UserUpdate, db: Session = Depends(get_db)):
    
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        
        if user_update.user_id and user_update.user_id != user.user_id:
            existing_by_user_id = db.query(User).filter(User.user_id == user_update.user_id).first()
            if existing_by_user_id:
                raise HTTPException(status_code=409, detail="User ID already exists")
        
        if user_update.email and user_update.email != user.email:
            existing_by_email = db.query(User).filter(User.email == str(user_update.email)).first()
            if existing_by_email:
                raise HTTPException(status_code=409, detail="Email already exists")
        
        if user_update.user_id is not None:
            user.user_id = user_update.user_id
        if user_update.email is not None:
            user.email = str(user_update.email)
        if user_update.university is not None:
            user.university = user_update.university
        if user_update.department is not None:
            user.department = user_update.department
        if user_update.grade is not None:
            user.grade = user_update.grade
        if user_update.term_id is not None:
            user.term_id = user_update.term_id
        if user_update.password is not None:
            user.password_hash = _hash_password(user_update.password)
        
        db.commit()
        db.refresh(user)
        return user
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update user: {str(e)}")

@app.get("/api/users/{user_id}", response_model=UserResponse)
def get_user(user_id: str, db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user: {str(e)}")

@app.get("/api/courses")
async def get_courses(term_id: int = None, db: Session = Depends(get_db)):
    try:
        query = db.query(Course)
        if term_id:
            query = query.filter(Course.term_id == term_id)
        courses = query.all()
        # If no courses found for the given term, gracefully fall back to all courses
        if term_id and not courses:
            courses = db.query(Course).all()
        return [
            {
                "course_id": course.course_id,
                "course_code": course.course_code,
                "course_name": course.course_name,
                "professor": course.professor,
                "schedule": course.schedule,
                "has_final_exam": course.has_final_exam,
                "format": course.format,
                "category": course.category,
                "term_id": course.term_id
            }
            for course in courses
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get courses: {str(e)}")

@app.post("/api/preferences")
async def save_preferences(preference: PreferenceCreate, db: Session = Depends(get_db)):
    try:
        db_preference = UserPreference(**preference.dict())
        db.add(db_preference)
        db.commit()
        db.refresh(db_preference)
        
        return {
            "id": db_preference.id,
            "time": db_preference.time,
            "finals": db_preference.finals,
            "dayOff": db_preference.dayOff,
            "modality": db_preference.modality,
            "liberalArts": db_preference.liberalArts,
            "preferredProfessors": db_preference.preferredProfessors,
            "dislikedProfessors": db_preference.dislikedProfessors,
            "created_at": db_preference.created_at.isoformat() if db_preference.created_at else None
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save preferences: {str(e)}")

@app.get("/api/preferences")
async def get_preferences(db: Session = Depends(get_db)):
    try:
        preferences = db.query(UserPreference).all()
        return [
            {
                "id": p.id,
                "time": p.time,
                "finals": p.finals,
                "dayOff": p.dayOff,
                "modality": p.modality,
                "liberalArts": p.liberalArts,
                "preferredProfessors": p.preferredProfessors,
                "dislikedProfessors": p.dislikedProfessors,
                "created_at": p.created_at.isoformat() if p.created_at else None
            }
            for p in preferences
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get preferences: {str(e)}")

@app.post("/api/generate-schedule")
async def generate_schedule(preferences: PreferenceCreate, term_id: int = None, db: Session = Depends(get_db)):
    try:
        query = db.query(Course)
        if term_id:
            query = query.filter(Course.term_id == term_id)
        courses = query.all()
        
        catalog = []
        for course in courses:
            schedule_parts = course.schedule.split(', ')
            for part in schedule_parts:
                day_period = part.split(' ')
                if len(day_period) == 2:
                    day, period = day_period
                    catalog.append({
                        "id": course.course_id,
                        "name": course.course_code,
                        "day": day,
                        "period": int(period),
                        "professor": course.professor,
                        "hasFinal": course.has_final_exam == 'yes',
                        "modality": course.format,
                        "category": course.category,
                        "courseName": course.course_name
                    })
        
        days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
        periods = [1, 2, 3, 4, 5, 6, 7]
        max_classes = 12
        
        day_off_day = None
        if preferences.dayOff and preferences.dayOff != "none":
            day_off_mapping = {
                "monday": "Mon", "tuesday": "Tue", "wednesday": "Wed",
                "thursday": "Thu", "friday": "Fri"
            }
            day_off_day = day_off_mapping.get(preferences.dayOff)
        
        disliked = set()
        if preferences.dislikedProfessors:
            disliked = set(p.strip().lower() for p in preferences.dislikedProfessors.split(",") if p.strip())
        
        preferred = set()
        if preferences.preferredProfessors:
            preferred = set(p.strip().lower() for p in preferences.preferredProfessors.split(",") if p.strip())
        
        best_per_slot = []
        
        has_preferences = (
            preferences.time != "none" or 
            preferences.finals != "none" or 
            preferences.dayOff != "none" or 
            preferences.modality != "none" or 
            preferences.liberalArts != "none" or 
            preferences.preferredProfessors or 
            preferences.dislikedProfessors
        )
        
        for day in days:
            for period in periods:
                key = f"{day}-{period}"
                
                
                if day_off_day and day == day_off_day:
                    best_per_slot.append({"key": key, "course": None, "score": float('-inf')})
                    continue
                
              
                candidates = [c for c in catalog if c["day"] == day and c["period"] == period]
                
                best = None
                best_score = float('-inf')
                
                for course in candidates:
                    if course["professor"].lower() in disliked:
                        continue
                    
                    score = 0
                    
                    if course["professor"].lower() in preferred:
                        score += 2.0
                    
                    if preferences.time == "morning":
                        if period <= 2:  
                            score += 10  
                        else:  
                            score -= 5  
                    elif preferences.time == "afternoon":
                        if 3 <= period <= 5: 
                            score += 10  
                        else:  
                            score -= 5  
                    elif preferences.time == "late":
                        if period >= 6:  
                            score += 10 
                        else: 
                            score -= 5  
                    elif not has_preferences:
                       
                        if period in [1, 3, 5]:  
                            score += 0.5
                    
                    if preferences.finals == "prefer-finals":
                        score += 1.5 if course["hasFinal"] else -0.5
                    elif preferences.finals == "avoid-finals":
                        score += -1.0 if course["hasFinal"] else 1.0
                    
                    if preferences.modality and preferences.modality != "none":
                        score += 5.0 if course["modality"] == preferences.modality else -2.0
                    
                    if preferences.liberalArts == "prefer-la":
                        score += 1.0 if course["category"] == "liberal-arts" else -0.25
                    elif preferences.liberalArts == "prefer-specialized":
                        score += 1.0 if course["category"] == "specialized" else -0.25
                    
                    import random
                    score += random.uniform(0, 2.0)  
                    
                    if score > best_score:
                        best_score = score
                        best = course
                
                best_per_slot.append({"key": key, "course": best, "score": best_score})
        
        chosen = sorted([x for x in best_per_slot if x["course"]], key=lambda x: x["score"], reverse=True)
        keep_set = set([x["key"] for x in chosen[:max_classes]])
        
        final_schedule = {}
        for slot in best_per_slot:
            final_schedule[slot["key"]] = slot["course"] if slot["key"] in keep_set else None
        
        total_classes = len([v for v in final_schedule.values() if v is not None])
        
        return {
            "schedule": final_schedule,
            "total_classes": total_classes,
            "max_classes": max_classes,
            "day_off": day_off_day  
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate schedule: {str(e)}")

# ------------------ Saved Schedules ------------------
@app.post("/api/saved-schedules", response_model=SavedScheduleResponse)
async def create_saved_schedule(schedule_data: SavedScheduleCreate, user_id: int, db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        db_schedule = SavedSchedule(
            user_id=user_id,
            name=schedule_data.name,
            preferences=schedule_data.preferences,
            schedule=schedule_data.schedule,
            day_off=schedule_data.day_off
        )
        db.add(db_schedule)
        db.commit()
        db.refresh(db_schedule)
        
        return {
            "id": db_schedule.id,
            "user_id": db_schedule.user_id,
            "name": db_schedule.name,
            "preferences": db_schedule.preferences,
            "schedule": db_schedule.schedule,
            "day_off": db_schedule.day_off,
            "created_at": db_schedule.created_at
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save schedule: {str(e)}")

@app.get("/api/saved-schedules", response_model=List[SavedScheduleResponse])
async def get_saved_schedules(user_id: int, db: Session = Depends(get_db)):
    try:
        schedules = db.query(SavedSchedule).filter(SavedSchedule.user_id == user_id).order_by(SavedSchedule.created_at.desc()).all()
        return [
            {
                "id": s.id,
                "user_id": s.user_id,
                "name": s.name,
                "preferences": s.preferences,
                "schedule": s.schedule,
                "day_off": s.day_off,
                "created_at": s.created_at
            }
            for s in schedules
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get saved schedules: {str(e)}")

@app.delete("/api/saved-schedules/{schedule_id}")
async def delete_saved_schedule(schedule_id: int, user_id: int, db: Session = Depends(get_db)):
    try:
        schedule = db.query(SavedSchedule).filter(
            SavedSchedule.id == schedule_id,
            SavedSchedule.user_id == user_id
        ).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        db.delete(schedule)
        db.commit()
        return {"message": "Schedule deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete schedule: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
