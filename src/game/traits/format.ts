// 0.075 -> "7.5%", 0.2 -> "20%"
export const pct = (n: number) => `${+(n * 100).toFixed(1)}%`;
