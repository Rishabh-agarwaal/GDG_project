from fastapi import FastAPI
from pydantic import BaseModel
import google.generativeai as genai
from fastapi.middleware.cors import CORSMiddleware
import os

from dotenv import load_dotenv  # <--- NEW IMPORT

# 1. Load the Secret Keys
load_dotenv() 
api_key = os.getenv("API_KEY") # <--- Get key from .env file

if not api_key:
    print("ERROR: API Key not found! Check your .env file.")
else:
    genai.configure(api_key=api_key)


app = FastAPI()

# 1. FIX CORS (Allows your frontend to talk to backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# 2. SETUP GEMINI (Replace with your ACTUAL API Key)

GENAI_API_KEY = api_key


genai.configure(api_key=GENAI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')

class PatientData(BaseModel):
    prompt: str

@app.post("/predict")
async def analyze_health(data: PatientData):
    try:
        # Ask Gemini
        response = model.generate_content(data.prompt)
        
        # Check if response is valid
        if response.text:
            return {"analysis": response.text}
        else:
            return {"analysis": "Error: Gemini could not generate a response."}
            
    except Exception as e:
        print(f"SERVER ERROR: {e}") # This prints the error to your terminal
        return {"analysis": f"Server Error: {str(e)}"}