環境構築

```fish
mise use node@latest
pip install fastapi "uvicorn[standard]"
```

実行
```fish
npm run dev
```
別ウィンドウで
```fish
uvicorn main:app --reload --port 8000
```
をそれぞれ実行
多分その前にSpleeterをいれる必要はある
そして
http://localhost:3000
にアクセス
