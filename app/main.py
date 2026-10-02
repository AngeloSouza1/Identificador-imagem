from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app import db
from app.recognition import (
    InvalidImageError,
    MAX_IMAGE_BYTES,
    MultipleFacesError,
    NoFaceError,
    RecognitionError,
    best_match,
    extract_embedding,
)

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="Identificador de Imagem", version="1.0.0")


@app.on_event("startup")
def on_startup() -> None:
    db.init_db()


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.post("/api/register")
async def register(
    nome: str = Form(...),
    consentimento: str = Form(...),
    imagem: UploadFile = File(...),
):
    if consentimento not in ("true", "on", "1", "sim", "Sim"):
        raise HTTPException(
            status_code=400,
            detail="O consentimento para uso do dado biométrico é obrigatório.",
        )

    nome = nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe um nome válido.")

    image_bytes = await _read_image(imagem)

    try:
        embedding = extract_embedding(image_bytes)
    except NoFaceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except MultipleFacesError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except InvalidImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RecognitionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    user_id = db.insert_user(nome, embedding)
    return JSONResponse(
        status_code=201,
        content={"mensagem": "Usuário cadastrado com sucesso.", "id": user_id, "nome": nome},
    )


@app.post("/api/identify")
async def identify(imagem: UploadFile = File(...)):
    image_bytes = await _read_image(imagem)

    try:
        embedding = extract_embedding(image_bytes)
    except NoFaceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except MultipleFacesError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except InvalidImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RecognitionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    users = db.get_all_users()
    match = best_match(users, embedding)

    if match is None:
        return {"reconhecido": False, "mensagem": "Rosto não reconhecido."}

    return {
        "reconhecido": True,
        "nome": match["nome"],
        "confianca": match["confianca"],
        "distancia": match["distancia"],
    }


@app.delete("/api/users/{user_id}")
async def delete_user(user_id: int):
    if not db.delete_user(user_id):
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return {"mensagem": "Cadastro removido com sucesso."}


async def _read_image(imagem: UploadFile) -> bytes:
    content_type = imagem.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=400, detail="Arquivo inválido. Envie uma imagem."
        )

    image_bytes = await imagem.read()
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Imagem muito grande. O tamanho máximo permitido é {MAX_IMAGE_BYTES // (1024 * 1024)} MB.",
        )
    return image_bytes


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
