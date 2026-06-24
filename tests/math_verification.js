const VOCAB = 128, EDIM = 16, N_MOODS = 11;
const M = {
  zeros: (n) => new Float32Array(n),
  randn: (n, scale = 0.1) => {
    const d = new Float32Array(n);
    for (let i = 0; i < n; i++) d[i] = (Math.random() - 0.5) * 2 * scale;
    return d;
  },
  linear: (x, W, b, inD, outD) => {
    const y = new Float32Array(outD);
    for (let j = 0; j < outD; j++) {
      let s = b[j];
      for (let i = 0; i < inD; i++) s += W[i * outD + j] * x[i];
      y[j] = s;
    }
    return y;
  },
  linearBack: (dy, x, W, inD, outD) => {
    const dW = new Float32Array(inD * outD), db = new Float32Array(outD), dx = new Float32Array(inD);
    for (let j = 0; j < outD; j++) db[j] = dy[j];
    for (let i = 0; i < inD; i++) for (let j = 0; j < outD; j++) {
      dW[i * outD + j] = x[i] * dy[j];
      dx[i] += W[i * outD + j] * dy[j];
    }
    return { dW, db, dx };
  },
  dot: (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
};
class Linear {
  constructor(inD, outD) {
    this.inD = inD; this.outD = outD;
    this.W = M.randn(inD * outD, 0.5);
    this.b = M.randn(outD, 0.5);
  }
  fwd(x) { this._x = x; return M.linear(x, this.W, this.b, this.inD, this.outD); }
  bwd(dy) {
    const { dW, db, dx } = M.linearBack(dy, this._x, this.W, this.inD, this.outD);
    this._dW = dW; this._db = db;
    return dx;
  }
}
class Scorer {
  constructor() {
    this.W = M.randn(EDIM * EDIM, 0.4);
  }
  score(ctx, resp) {
    const Wv = M.zeros(EDIM);
    for (let i = 0; i < EDIM; i++) for (let j = 0; j < EDIM; j++) Wv[i] += this.W[i * EDIM + j] * resp[j];
    this._cache = { ctx, resp };
    return M.dot(ctx, Wv);
  }
  bwd(grad) {
    const { ctx, resp } = this._cache;
    const dW = M.zeros(EDIM * EDIM);
    for (let i = 0; i < EDIM; i++) for (let j = 0; j < EDIM; j++) dW[i * EDIM + j] = grad * ctx[i] * resp[j];
    this._dW = dW;
  }
}
function check(name, analytical, numerical, tol = 5e-2) {
  const diff = Math.abs(analytical - numerical);
  if (diff < 1e-5) return true;
  const rel = diff / (Math.max(1e-8, Math.abs(analytical) + Math.abs(numerical)));
  if (rel > tol) {
    console.error(`[FAIL] ${name}: Analytical=${analytical.toFixed(6)}, Numerical=${numerical.toFixed(6)}, RelDiff=${rel.toExponential(2)}`);
    return false;
  }
  return true;
}
function runVerification() {
  console.log("--- Neural Engine Mathematical Verification ---");
  let allPass = true;
  const eps = 1e-4;
  const lin = new Linear(4, 2);
  const x = new Float32Array([0.5, -0.3, 0.8, 0.1]);
  const dy = new Float32Array([1.0, -0.5]);
  lin.fwd(x); lin.bwd(dy);
  let linPass = true;
  for (let i = 0; i < lin.W.length; i++) {
    const orig = lin.W[i];
    lin.W[i] = orig + eps; const lossP = M.dot(lin.fwd(x), dy);
    lin.W[i] = orig - eps; const lossM = M.dot(lin.fwd(x), dy);
    lin.W[i] = orig;
    if (!check(`Linear.W[${i}]`, lin._dW[i], (lossP - lossM) / (2 * eps))) linPass = false;
  }
  if (linPass) console.log("[PASS] Linear layer gradients."); else allPass = false;
  const sc = new Scorer();
  const ctx = M.randn(EDIM, 0.5);
  const resp = M.randn(EDIM, 0.5);
  sc.score(ctx, resp); sc.bwd(1.0);
  let scPass = true;
  for (let i = 0; i < sc.W.length; i++) {
    const orig = sc.W[i];
    sc.W[i] = orig + eps; const lossP = sc.score(ctx, resp);
    sc.W[i] = orig - eps; const lossM = sc.score(ctx, resp);
    sc.W[i] = orig;
    if (!check(`Scorer.W[${i}]`, sc._dW[i], (lossP - lossM) / (2 * eps))) scPass = false;
  }
  if (scPass) console.log("[PASS] Scorer gradients."); else allPass = false;
  if (allPass) console.log("\nVERIFICATION COMPLETE: Neural core is mathematically sound.");
  else { console.error("\nVERIFICATION FAILED."); process.exit(1); }
}
runVerification();
