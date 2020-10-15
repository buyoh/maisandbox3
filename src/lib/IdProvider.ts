let identificationCounter = 0;

// ページ起動時から有効である十分に識別可能な値を返す
// ページ起動時から有効: リロードを跨ぐと衝突する
export const IdProvider = {
  nextNumber(): number {
    if (!identificationCounter)
      identificationCounter = 0;
    return identificationCounter += 1;
  }
};
