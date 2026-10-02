import io

import face_recognition
import numpy as np
from PIL import Image

MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_DIMENSION = 1024
MATCH_THRESHOLD = 0.5


class RecognitionError(Exception):
    """Erro base de reconhecimento facial."""


class InvalidImageError(RecognitionError):
    pass


class NoFaceError(RecognitionError):
    pass


class MultipleFacesError(RecognitionError):
    pass


def _decode_and_resize(image_bytes: bytes) -> np.ndarray:
    if len(image_bytes) == 0:
        raise InvalidImageError("Arquivo de imagem vazio.")

    try:
        image = Image.open(io.BytesIO(image_bytes))
        image.load()
    except Exception as exc:
        raise InvalidImageError("Imagem inválida ou formato não suportado.") from exc

    image = image.convert("RGB")

    width, height = image.size
    if max(width, height) > MAX_DIMENSION:
        scale = MAX_DIMENSION / max(width, height)
        image = image.resize((int(width * scale), int(height * scale)), Image.LANCZOS)

    return np.array(image)


def extract_embedding(image_bytes: bytes) -> list[float]:
    image = _decode_and_resize(image_bytes)

    locations = face_recognition.face_locations(image, model="hog")
    if len(locations) == 0:
        raise NoFaceError("Nenhum rosto detectado na imagem.")
    if len(locations) > 1:
        raise MultipleFacesError(
            f"Mais de um rosto detectado ({len(locations)} rostos). Envie uma foto com apenas um rosto."
        )

    encodings = face_recognition.face_encodings(image, known_face_locations=locations)
    if not encodings:
        raise NoFaceError("Não foi possível extrair o rosto da imagem.")

    return encodings[0].tolist()


def best_match(known_users: list[dict], target_embedding: list[float]) -> dict | None:
    if not known_users:
        return None

    known_embeddings = [np.array(user["embedding"]) for user in known_users]
    target = np.array(target_embedding)

    distances = face_recognition.face_distance(known_embeddings, target)
    min_index = int(np.argmin(distances))
    distance = float(distances[min_index])

    if distance > MATCH_THRESHOLD:
        return None

    confidence = max(0.0, min(1.0, 1.0 - distance)) * 100.0
    user = known_users[min_index]
    return {
        "id": user["id"],
        "nome": user["nome"],
        "distancia": round(distance, 4),
        "confianca": round(confidence, 2),
    }
