from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import tryon

app = FastAPI(title="TryNova AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TryOnRequest(BaseModel):
    userImage: str
    productImage: str

@app.post("/tryon")
async def process_tryon(request: TryOnRequest):
    try:
        # Pass base64 or URL to the pipeline
        result_base64 = tryon.run_pipeline(request.userImage, request.productImage)
        return {"success": True, "resultImageUrl": f"data:image/jpeg;base64,{result_base64}"}
    except Exception as e:
        print(f"Error in tryon pipeline: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"message": "TryNova AI Service is running"}
