from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON, Date
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class Term(Base):
    __tablename__ = "terms"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False)  # e.g., 2025S
    name = Column(String(100), nullable=False)  # e.g., 2025 Spring
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    courses = relationship("Course", back_populates="term")

class Course(Base):
    __tablename__ = "courses"
    
    course_id = Column(Integer, primary_key=True, index=True)
    course_code = Column(String(20), nullable=False)
    course_name = Column(String(100), nullable=False)
    professor = Column(String(100), nullable=False)
    schedule = Column(String(100), nullable=False)
    has_final_exam = Column(String(10), nullable=False)
    format = Column(String(20), nullable=False)
    category = Column(String(20), nullable=False)
    term_id = Column(Integer, ForeignKey("terms.id"), nullable=True)

    # Relationships
    term = relationship("Term", back_populates="courses")

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    email = Column(String(100), nullable=False)
    university = Column(String(100))
    department = Column(String(50))
    grade = Column(String(20))
    term_id = Column(Integer, ForeignKey("terms.id"), nullable=True)  
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    term = relationship("Term")
    preferences = relationship("UserPreference", back_populates="user")
    saved_schedules = relationship("SavedSchedule", back_populates="user")

class UserPreference(Base):
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    time = Column(String(50))
    finals = Column(String(50))
    dayOff = Column(String(50))
    modality = Column(String(50))
    liberalArts = Column(String(50))
    preferredProfessors = Column(Text)
    dislikedProfessors = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="preferences")

class SavedSchedule(Base):
    __tablename__ = "saved_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    preferences = Column(JSON)  # Store preferences as JSON
    schedule = Column(JSON)  # Store schedule as JSON
    day_off = Column(String(10))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="saved_schedules")


