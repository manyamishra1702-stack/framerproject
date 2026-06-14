from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel
import os
import json
import base64
from dotenv import load_dotenv
from openai import OpenAI, AsyncOpenAI

load_dotenv()

router = APIRouter()

VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
TEXT_MODEL = "llama-3.3-70b-versatile"
GROQ_BASE = "https://api.groq.com/openai/v1"


def _get_client() -> OpenAI:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set. Add it to your server/.env file.")
    return OpenAI(api_key=api_key, base_url=GROQ_BASE)


def _get_async_client() -> AsyncOpenAI:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set. Add it to your server/.env file.")
    return AsyncOpenAI(api_key=api_key, base_url=GROQ_BASE)


@router.post("/disease-detection")
async def detect_disease(file: UploadFile = File(...)):
    try:
        client = _get_client()
        image_bytes = await file.read()
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        response = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": """Analyze this image carefully.

Rules:
1. If this is NOT a crop/plant/agriculture image, return exactly: INVALID_IMAGE
2. If the crop is healthy, return exactly: HEALTHY
3. If a disease is detected, return ONLY the disease name.

Examples: HEALTHY | Tomato Early Blight | Leaf Rust | Powdery Mildew | INVALID_IMAGE"""
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{file.content_type};base64,{image_b64}"
                            }
                        }
                    ]
                }
            ]
        )

        disease_name = response.choices[0].message.content.strip()

        if disease_name == "INVALID_IMAGE":
            return {"disease": "INVALID IMAGE", "confidence": 0, "recommendation": "Please upload a crop or plant image."}
        if disease_name == "HEALTHY":
            return {"disease": "HEALTHY", "confidence": 100, "recommendation": "No disease detected. Crop appears healthy."}
        return {"disease": disease_name.upper(), "confidence": 95, "recommendation": f"Disease detected: {disease_name}"}

    except RuntimeError as e:
        return {"disease": "CONFIG ERROR", "confidence": 0, "recommendation": str(e)}
    except Exception as e:
        msg = str(e)
        print(f"[disease-detection ERROR] {type(e).__name__}: {msg}")
        if "429" in msg or "rate_limit" in msg.lower():
            return {"disease": "RATE LIMITED", "confidence": 0, "recommendation": "Too many requests. Please wait a moment and try again."}
        return {"disease": "ERROR", "confidence": 0, "recommendation": f"Analysis failed: {msg}"}


class AnalyzeRequest(BaseModel):
    text: str


@router.post("/analyze")
async def analyze_farmer_text(request: AnalyzeRequest):
    try:
        client = _get_client()
        response = client.chat.completions.create(
            model=TEXT_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": f"Analyze the following farmer activity and provide insights or advice: {request.text}"
                }
            ]
        )
        return {"analysis": response.choices[0].message.content}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scan")
async def scan_disease(file: UploadFile = File(...)):
    try:
        client = _get_client()
        image_bytes = await file.read()
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        response = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Analyze this plant image and tell me if there are any diseases. If there is a disease, what is it and what is the recommendation?"
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{file.content_type};base64,{image_b64}"
                            }
                        }
                    ]
                }
            ]
        )

        return {"filename": file.filename, "disease_analysis": response.choices[0].message.content}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def generate_market_data(crop: str, location: str = None, language: str = 'en'):
    lang_map = {
        'hi': 'Hindi', 'mr': 'Marathi', 'pa': 'Punjabi',
        'te': 'Telugu', 'ta': 'Tamil', 'en': 'English'
    }
    lang_name = lang_map.get(language[:2] if language else 'en', 'English')
    location_text = f"specifically for {location}" if location else "in India"

    prompt = f"""
    You are an expert agricultural economist in India.
    Provide a highly realistic current market price per quintal in INR for {crop} {location_text}.
    Also predict the price for next month based on typical seasonal trends.
    Give a system advice as either "Hold" or "Sell Now" based on the trend.
    Additionally, provide realistic historical price data for the past 6 months.
    Provide a 2-3 sentence 'graph_explanation' explaining this historical trend data.
    CRITICAL: This 'graph_explanation' MUST be written entirely in {lang_name}.
    Respond ONLY with a valid JSON object in the exact format below:
    {{
      "crop": "{crop}",
      "current_price_per_quintal": 2500.50,
      "predicted_price_next_month": 2650.00,
      "advice": "Hold",
      "graph_explanation": "YOUR {lang_name} EXPLANATION HERE",
      "historical_data": [
        {{"month": "Jan", "price": 2400}},
        {{"month": "Feb", "price": 2450}},
        {{"month": "Mar", "price": 2420}},
        {{"month": "Apr", "price": 2480}},
        {{"month": "May", "price": 2500}},
        {{"month": "Jun", "price": 2500}}
      ]
    }}
    """

    try:
        client = _get_async_client()
        response = await client.chat.completions.create(
            model=TEXT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        data = json.loads(response.choices[0].message.content)
        return {
            "crop": crop,
            "current_price_per_quintal": round(float(data.get("current_price_per_quintal", 2400.0)), 2),
            "predicted_price_next_month": round(float(data.get("predicted_price_next_month", 2500.0)), 2),
            "advice": data.get("advice", "Hold"),
            "graph_explanation": data.get("graph_explanation", ""),
            "historical_data": data.get("historical_data", [])
        }
    except Exception as e:
        print(f"Error parsing Groq response: {e}")
        return {
            "crop": crop,
            "current_price_per_quintal": 2400.00,
            "predicted_price_next_month": 2550.00,
            "advice": "Hold",
            "graph_explanation": "Could not generate explanation.",
            "historical_data": [
                {"month": "M-6", "price": 2300},
                {"month": "M-5", "price": 2350},
                {"month": "M-4", "price": 2320},
                {"month": "M-3", "price": 2400},
                {"month": "M-2", "price": 2450},
                {"month": "M-1", "price": 2400}
            ]
        }


@router.get("/price-prediction")
async def get_price_prediction(crop: str, location: str = None, language: str = 'en'):
    return await generate_market_data(crop, location, language)


@router.get("/irrigation-recommendation")
async def get_irrigation(location: str):
    return {
        "location": location,
        "forecast": "Light rain expected in 2 days.",
        "soil_moisture_estimate": "45%",
        "recommendation": "Delay watering until after the rain."
    }
