declare global {
  var identificationCounter: number;
}

// ページ起動時から有効である十分に識別可能な値を返す
// ページ起動時から有効: リロードを跨ぐと衝突する
export const IdProvider = {
  nextNumber(): number {
    if (!global.identificationCounter)
      global.identificationCounter = 0;
    return global.identificationCounter += 1;
  }
};
