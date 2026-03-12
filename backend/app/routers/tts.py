from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()


@router.post("/tts")
async def text_to_speech():
    return JSONResponse(
        status_code=501,
        content={"detail": "TTS is not yet implemented."},
    )
