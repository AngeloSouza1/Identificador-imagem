# Identificador de Imagem

Landing page que identifica um usuário cadastrado a partir de uma foto, usando
reconhecimento facial. Apenas o **embedding facial de 128 dimensões** é
armazenado — **nenhuma foto original é salva**.

## Stack

- **Backend:** Python 3 + FastAPI + uvicorn
- **Reconhecimento facial:** `face_recognition` (dlib)
- **Processamento de imagem:** Pillow + numpy
- **Upload:** python-multipart
- **Banco:** SQLite (tabela `users`)
- **Frontend:** HTML + CSS + JS puro (servido pelo FastAPI em `/static`)

## Pré-requisitos

O `dlib` precisa ser compilado. Instale as ferramentas de build antes:

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install -y build-essential cmake python3-dev python3-pip python3-venv

# Para acelerar o dlib (opcional)
sudo apt install -y libopenblas-dev liblapack-dev
```

Também é necessário ter uma webcam (para captura) ou imagens de teste.

## Instalação

```bash
cd /home/angelo/Downloads/Identificador-imagem

# Crie e ative um ambiente virtual (recomendado)
python3 -m venv venv
source venv/bin/activate

# Instale as dependências (o dlib pode levar alguns minutos para compilar)
pip install --upgrade pip
pip install -r requirements.txt
```

## Como rodar

Com o ambiente virtual ativo:

```bash
uvicorn app.main:app --reload
```

Ou, diretamente:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Acesse a landing page em <http://localhost:8000>.

## Endpoints

| Método | Rota               | Descrição                                                      |
|--------|--------------------|----------------------------------------------------------------|
| GET    | `/`                | Landing page                                                   |
| POST   | `/api/register`    | Cadastra usuário (`nome`, `imagem`, `consentimento`)           |
| POST   | `/api/identify`    | Identifica a partir de uma `imagem`                            |
| DELETE | `/api/users/{id}`  | Remove o cadastro (direito de exclusão, LGPD)                  |

### Exemplos

Cadastrar:

```bash
curl -X POST http://localhost:8000/api/register \
  -F "nome=Maria" \
  -F "consentimento=true" \
  -F "imagem=@/caminho/para/foto.jpg"
```

Identificar:

```bash
curl -X POST http://localhost:8000/api/identify \
  -F "imagem=@/caminho/para/foto.jpg"
```

Excluir:

```bash
curl -X DELETE http://localhost:8000/api/users/1
```

## Como testar

1. Suba o servidor (`uvicorn app.main:app --reload`).
2. Na aba **Cadastrar**, informe um nome, autorize o consentimento e envie uma
   foto com **exatamente um rosto**.
3. Vá para a aba **Identificar** e envie outra foto da mesma pessoa.
   O resultado mostrará o nome e a porcentagem de confiança.
4. Envie a foto de uma pessoa não cadastrada para ver o "não reconhecido".

Pela linha de comando:

```bash
# Cadastrar uma pessoa
curl -X POST http://localhost:8000/api/register \
  -F "nome=Teste" -F "consentimento=true" -F "imagem=@foto1.jpg"

# Identificar
curl -X POST http://localhost:8000/api/identify -F "imagem=@foto2.jpg"
```

## Regras de negócio

- **Nenhum rosto** → erro `422` com mensagem clara.
- **Mais de um rosto** → erro `422`.
- **Imagem inválida** → erro `400`.
- **Imagem > 5 MB** → erro `400`.
- **Sem consentimento** → erro `400`.
- A imagem é redimensionada (máx. 1024px) antes do processamento.
- Uma pessoa é considerada reconhecida quando a menor `face_distance` é
  **menor ou igual a 0.5**.

## Privacidade (LGPD)

A foto original nunca é salva. Após o processamento, apenas o vetor
(embedding) de 128 números é armazenado no SQLite. O usuário pode solicitar a
exclusão do cadastro a qualquer momento via `DELETE /api/users/{id}`.

## Estrutura do projeto

```
Identificador-imagem/
├── app/
│   ├── __init__.py
│   ├── main.py          # Rotas e FastAPI app
│   ├── recognition.py   # Lógica de reconhecimento facial
│   └── db.py            # Acesso ao SQLite
├── static/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── requirements.txt
└── README.md
```

## Área administrativa (senha)

Cadastro, listagem e remoção exigem a variável de ambiente `ADMIN_PASSWORD`
e o cabeçalho `X-Admin-Password`. Sem a variável definida, essas rotas ficam
bloqueadas (503). A identificação (`POST /api/identify`) continua pública.

```bash
ADMIN_PASSWORD='sua-senha' uvicorn app.main:app

# listar e remover cadastros
curl -H "X-Admin-Password: sua-senha" http://localhost:8000/api/users
curl -X DELETE -H "X-Admin-Password: sua-senha" http://localhost:8000/api/users/1
```

## Deploy (Render)

O `render.yaml` cria o serviço Docker com disco persistente em `/data` e gera
uma `ADMIN_PASSWORD` aleatória (veja em *Environment* no painel). O disco
persistente exige plano pago.
