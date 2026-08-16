export type PreparedImage = {
  id: string;
  previewUrl: string;
  media_type: string;
  data: string; // base64（プレフィックスなし）
};

const MAX_EDGE = 2200; // Claude の高解像度上限内に収めつつ、手書き文字が読める大きさ

/**
 * アップロードされた画像を JPEG に縮小して base64 化する。
 * 大きすぎる写真をそのまま送ると、トークン費とアップロード時間が無駄に増える。
 */
export function prepareImage(file: File): Promise<PreparedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("画像を読み込めませんでした。"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("画像を表示できませんでした。"));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        resolve({
          id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
          previewUrl: dataUrl,
          media_type: "image/jpeg",
          data: dataUrl.split(",")[1],
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
