from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from pysentimiento import create_analyzer

analyzer = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global analyzer
    print('Cargando modelo RoBERTuito (pysentimiento)...')
    analyzer = create_analyzer(task="sentiment", lang="es")
    print('Modelo de sentimiento listo.')
    yield
    analyzer = None


app = FastAPI(title="Servicio de Sentimiento", lifespan=lifespan)


class AnalisisRequest(BaseModel):
    texto: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
def analyze(body: AnalisisRequest):
    if analyzer is None:
        raise HTTPException(status_code=503, detail="Modelo aún no disponible")
    try:
        resultado = analyzer.predict(body.texto)
        return {
            "label": resultado.output,
            "scores": {clase: float(prob) for clase, prob in resultado.probas.items()},
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))