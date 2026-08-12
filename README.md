# Automated Schedule Planner
This document explains how to set up and run the Automated Schedule Planner project on macOS. The project consists of a Python FastAPI backend and a Vite/JavaScript frontend. Use two terminals to run both services.

## Folder Structure

```
schedule-planner/
├── backend/
│ ├── pycache/
│ ├── env/ # Virtual environment (not committed to Git)
│ ├── .gitignore
│ ├── database.py # DB connection setup
│ ├── main.py # FastAPI entry point
│ ├── models.py # SQLAlchemy models
│ ├── schemas.py # Pydantic schemas
│
└── frontend/
├── node_modules/ # Auto-generated dependencies
├── public/ # Static assets
├── src/ # React/Vite source code
├── .gitignore
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── README.md
├── vite.config.js
```

## Prerequisites

Install the following if not already installed:

- Homebrew (optional)
- Node.js LTS 20 (using nvm recommended)
- Python 3.11+ (3.12 OK)
- MySQL (if using MySQL database)

Installation commands (optional reference):

``` 
# Homebrew (if you don't have it)
# /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node setup using nvm
brew install nvm
nvm install 20
nvm use 20

# Python
brew install python

# MySQL
brew install mysql
brew services start mysql
```
## Backend Setup (Python / FastAPI)

1. Open a terminal and move to the backend directory:

```
cd /Users/yourname/Desktop/schedule-planner/backend
```

2. Create and activate a virtual environment:

```
python -m venv env
source env/bin/activate
```

3. Install dependencies:

```
pip install fastapi uvicorn sqlalchemy pymysql passlib[bcrypt] python-jose[cryptography]
```

4. Set environment variables:
   
```
export SECRET_KEY="your-very-secret-key"
export DATABASE_URL="mysql+pymysql://root:1234@localhost:3306/schedule_planner"
```

5. If using MySQL, create the database:

```
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS schedule_planner CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

6. Start the backend server:
   
```
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
## Frontend Setup (Vite / Node)

1. Open a second terminal and go to the frontend directory:

```
cd /Users/kimbyeolha/Desktop/schedule-planner/frontend
```

2. Install dependencies:
   
```
npm install
```

3. Start the development server:

npm run dev

## Stopping Servers

Press Ctrl + C in each terminal window.
