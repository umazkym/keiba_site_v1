import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database.database import engine

def main():
    try:
        with engine.connect() as conn:
            print("Adding ai_analysis_text column to races table...")
            # PostgreSQL syntax: ADD COLUMN IF NOT EXISTS
            conn.execute(text("ALTER TABLE races ADD COLUMN IF NOT EXISTS ai_analysis_text VARCHAR;"))
            conn.commit()
            print("Successfully added ai_analysis_text column.")
    except Exception as e:
        print(f"Error executing ALTER TABLE: {e}")

if __name__ == "__main__":
    main()
