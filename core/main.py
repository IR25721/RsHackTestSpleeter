import os
import shutil
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

# TensorFlowのログレベルを調整（INFOやWARNINGを抑制）
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
from spleeter.separator import Separator

# --- FastAPIアプリケーションのセットアップ ---
app = FastAPI()

origins = ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ディレクトリ設定 ---
# 一時アップロード用ディレクトリ
UPLOAD_DIR = Path("./uploads")
# Spleeterの出力先ディレクトリ
OUTPUT_DIR = Path("./output-python")

# 起動時にディレクトリが存在しない場合は作成
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)


# --- Spleeterの初期化 ---
# アプリケーション起動時に一度だけセパレーターを読み込むことで、リクエストごとの遅延をなくす
print("Spleeterセパレーターを初期化しています...")
separator = Separator("spleeter:5stems")
print("Spleeterセパレーターの初期化が完了しました。")


# --- Spleeter処理関数 ---
def spread(input_file_path: str, output_path: str):
    """指定されたオーディオファイルをSpleeterで分離する"""
    # インプットファイルと出力ディレクトリを指定して分離実行
    separator.separate_to_file(input_file_path, output_path)


# --- APIエンドポイント ---


@app.post("/process_audio/")
async def process_audio(file: UploadFile = File(...)):
    """オーディオファイルをアップロードし、Spleeterで処理するエンドポイント"""

    # 1. アップロードされたファイルを一意な名前で一時保存
    unique_id = str(uuid.uuid4())
    # Spleeterが出力するディレクトリ名の元になる部分
    output_subdir_name = f"{unique_id}_{Path(file.filename).stem}"
    input_filepath = UPLOAD_DIR / f"{output_subdir_name}{Path(file.filename).suffix}"

    try:
        with open(input_filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"ファイルの保存に失敗しました: {e}"
        )
    finally:
        file.file.close()

    # 2. Spleeterで音源分離を実行
    print(f"ファイル {input_filepath} の音源分離を開始します...")
    try:
        spread(str(input_filepath), str(OUTPUT_DIR))
        print("音源分離が完了しました。")
    except Exception as e:
        # 処理に失敗した場合はアップロードされたファイルを削除
        os.remove(input_filepath)
        raise HTTPException(
            status_code=500, detail=f"Spleeterでの処理中にエラーが発生しました: {e}"
        )

    # 3. 生成されたファイルの一覧を取得
    result_dir = OUTPUT_DIR / output_subdir_name
    if not result_dir.is_dir():
        raise HTTPException(
            status_code=404, detail="Spleeterの出力ディレクトリが見つかりません。"
        )

    processed_files = [f.name for f in result_dir.iterdir() if f.is_file()]

    # 4. 処理が終わったので、一時的に保存した入力ファイルを削除
    os.remove(input_filepath)

    # 5. フロントエンドに処理結果（出力ディレクトリ名とファイルリスト）を返す
    return {
        "message": "音源分離が完了しました。",
        "output_dir_name": output_subdir_name,
        "processed_files": processed_files,
    }


@app.get("/download/{output_dir_name}/{filename}")
async def download_processed_file(output_dir_name: str, filename: str):
    """処理済みのファイルをダウンロードさせるためのエンドポイント"""

    # セキュリティのため、パスに '..' が含まれていないかチェック
    if ".." in output_dir_name or ".." in filename:
        raise HTTPException(status_code=400, detail="無効なファイルパスです。")

    file_path = OUTPUT_DIR / output_dir_name / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="ファイルが見つかりません。")

    # FileResponseを使ってファイルを返す
    return FileResponse(
        path=file_path, media_type="application/octet-stream", filename=filename
    )
