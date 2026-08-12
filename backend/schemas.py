from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
from datetime import datetime, date

class CourseBase(BaseModel):
    course_code: str
    course_name: str
    professor: str
    schedule: str
    has_final_exam: str
    format: str
    category: str

class CourseResponse(CourseBase):
    course_id: int
    
    class Config:
        from_attributes = True

class TermCreate(BaseModel):
    code: str
    name: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: bool = False

class TermResponse(BaseModel):
    id: int
    code: str
    name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class PreferenceBase(BaseModel):
    time: Optional[str] = None
    finals: Optional[str] = None
    dayOff: Optional[str] = None
    modality: Optional[str] = None
    liberalArts: Optional[str] = None
    preferredProfessors: Optional[str] = None
    dislikedProfessors: Optional[str] = None

class PreferenceCreate(PreferenceBase):
    pass

class PreferenceResponse(PreferenceBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    user_id: str
    password: str
    email: EmailStr
    university: Optional[str] = None
    department: Optional[str] = None
    grade: Optional[str] = None
    term_id: Optional[int] = None  

class UserLogin(BaseModel):
    user_id: str
    password: str

class UserUpdate(BaseModel):
    user_id: Optional[str] = None  
    email: Optional[EmailStr] = None
    university: Optional[str] = None
    department: Optional[str] = None
    grade: Optional[str] = None
    term_id: Optional[int] = None
    password: Optional[str] = None 

class UserResponse(BaseModel):
    id: int
    user_id: str
    email: str
    university: Optional[str] = None
    department: Optional[str] = None
    grade: Optional[str] = None
    term_id: Optional[int] = None  
    created_at: datetime
    
    class Config:
        from_attributes = True

class SavedScheduleCreate(BaseModel):
    name: str
    preferences: Dict[str, Any]
    schedule: Dict[str, Any]
    day_off: Optional[str] = None

class SavedScheduleUpdate(BaseModel):
    name: Optional[str] = None

class SavedScheduleResponse(BaseModel):
    id: int
    user_id: int
    name: str
    preferences: Dict[str, Any]
    schedule: Dict[str, Any]
    day_off: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
