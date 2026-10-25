from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from boatops import __version__
from boatops.config import settings
from boatops.routers import marine, satellite, solar, stations, weather

app = FastAPI(title="BoatOps Iceland", version=__version__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.exception_handler(NotImplementedError)
async def not_implemented_handler(request: Request, exc: NotImplementedError):
    return JSONResponse(status_code=501, content={"detail": "not implemented yet"})


@app.get("/health")
async def health():
    return {"status": "ok", "version": __version__}


app.include_router(weather.router)
app.include_router(marine.router)
app.include_router(stations.router)
app.include_router(solar.router)
app.include_router(satellite.router)
