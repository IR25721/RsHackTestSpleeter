'use client';

import { useState, ChangeEvent, FormEvent } from 'react';

// バックエンドから返される処理結果の型を定義
interface ProcessedResult {
  output_dir_name: string;
  processed_files: string[];
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ProcessedResult | null>(null);

  // バックエンドサーバーのURL
  const API_BASE_URL = 'http://localhost:8000';

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setStatusMessage('');
      setResult(null);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFile) {
      setStatusMessage('ファイルが選択されていません。');
      return;
    }

    setIsLoading(true);
    setStatusMessage('ファイルをアップロードし、音源分離を開始します... (処理には数分かかる場合があります)');
    setResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/process_audio/`, {
        method: 'POST',
        body: formData,
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.detail || 'ファイルの処理に失敗しました。');
      }

      setResult(responseData);
      setStatusMessage(`処理が完了しました！以下のファイルをダウンロードできます。`);

    } catch (error) {
      console.error('Processing error:', error);
      if (error instanceof Error) {
        setStatusMessage(`エラー: ${error.message}`);
      } else {
        setStatusMessage('処理中に不明なエラーが発生しました。');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- ここからが修正・追加部分 ---

  const handleDownload = async (dirName: string, filename: string) => {
    try {
      // 1. fetchでファイルデータをリクエスト
      const response = await fetch(`${API_BASE_URL}/download/${dirName}/${filename}`);

      if (!response.ok) {
        throw new Error('ダウンロードに失敗しました。');
      }

      // 2. レスポンスからBlobオブジェクトを取得
      const blob = await response.blob();

      // 3. Blobから一時的なURLを生成
      const url = window.URL.createObjectURL(blob);

      // 4. aタグを動的に生成してダウンロードを実行
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename); // download属性にファイル名を設定
      document.body.appendChild(link);
      link.click();

      // 5. 後処理：aタグを削除し、URLを解放
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Download error:', error);
      setStatusMessage('ファイルのダウンロード中にエラーが発生しました。');
    }
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '700px', margin: 'auto' }}>
      <h1>Spleeter 音源分離アプリ</h1>
      <p>ボーカルと伴奏を分離したいオーディオファイル（mp3, wavなど）を選択してください。</p>

      <form onSubmit={handleSubmit}>
        <input
          type="file"
          onChange={handleFileChange}
          accept="audio/*"
          style={{ marginBottom: '1rem', display: 'block' }}
        />
        <button
          type="submit"
          disabled={!selectedFile || isLoading}
          style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', fontSize: '1rem' }}
        >
          {isLoading ? '処理中...' : '分離を開始'}
        </button>
      </form>

      {statusMessage && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '5px', backgroundColor: '#000000' }}>
          <p>{statusMessage}</p>
        </div>
      )}

      {/* --- ダウンロードリンク表示部分を修正 --- */}
      {result && (
        <div style={{ marginTop: '1.5rem' }}>
          <h2>ダウンロード</h2>
          <ul>
            {result.processed_files.map((filename) => (
              <li key={filename} style={{ marginBottom: '0.5rem' }}>
                {/* aタグの代わりにbuttonや、onClickを付けたaタグを使用 */}
                <button
                  onClick={() => handleDownload(result.output_dir_name, filename)}
                  style={{ all: 'unset', color: 'blue', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  {filename}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
} 
