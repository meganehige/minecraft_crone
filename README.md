# minecraft_crone

ブラウザで動く Minecraft 風ボクセルゲーム（TypeScript + Three.js）。

実際の Minecraft の仕組み（20Hz 固定ティックと描画の分離、チャンク化ボクセル、
面カリング、ノイズ地形、AABB 衝突、フラッドフィル照明、シード＋編集差分セーブ）を
調査したうえで、段階的に実装しています。

## 実行方法

```bash
npm install
npm run dev        # http://localhost:5173 を開く
```

ビルド / 型チェック:

```bash
npm run typecheck  # tsc --noEmit
npm run build      # tsc --noEmit && vite build
```

## 操作

- **マウス**: 視点移動（キャンバスをクリックでポインタロック）
- **WASD**: 移動、**Space**: ジャンプ、**Shift**: ダッシュ
- **左クリック**: ブロック破壊、**右クリック**: ブロック設置
- **1〜7**: ホットバーのブロック選択（石/土/草/砂/木/葉/水）

編集内容は IndexedDB に保存され、リロードしても復元されます（地形はシードから
決定論的に再生成）。

## アーキテクチャ

```
src/
├── core/        Game(統括) / Loop(固定20Hz+補間) / Config / Debug(window.__game)
├── math/        coords(座標変換)
├── world/       Chunk(ボクセル+光) / World(チャンク管理+BlockSource) / ChunkManager(ストリーミング)
│   ├── blocks/      BlockType / BlockRegistry / blocks
│   └── generation/  Noise(fBm) / TerrainGenerator(シード地形)
├── render/      ChunkMesher(面カリング+光焼き込み) / materials(アトラス) / atlas
├── lighting/    LightEngine(sky/block フラッドフィルBFS)
├── physics/     Collision(軸別スイープAABB)
├── player/      Player(物理) / Controls(入力)
├── interaction/ Raycast(ボクセルDDA) / BlockInteraction(設置/破壊)
├── ui/          crosshair / hotbar
└── persistence/ db(IndexedDB) / SaveManager(シード+編集差分)
```

### 主な仕組み
- **ゲームループ**: 固定 20 ティック/秒のシミュレーションと、可変フレームレートの
  描画を分離し、ティック間を補間（`core/Loop.ts`）。
- **チャンク**: 16×16×128 のフラット `Uint8Array`。プレイヤー周囲を距離順に
  生成/メッシュ/アンロード（フレーム予算付き、`ChunkManager`）。
- **描画**: チャンク単位で 1 メッシュ。空気/別の透明ブロックに面した面のみ生成
  （隠面除去）。テクスチャは手続き的に生成したアトラス。
- **地形**: simplex ノイズの多オクターブ fBm による高さ場（草/土/石、海面の水）。
  同一シードで同一ワールド。
- **照明**: 天空光（真下は減衰なし）とブロック光を BFS でフラッドフィルし、面の
  明るさ×面シェードを頂点カラーに焼き込み（`MeshBasicMaterial`）。
- **物理**: Y→X→Z の軸別スイープ AABB 衝突。重力・ジャンプ・接地判定。
- **セーブ**: シードと「生成結果からの差分（プレイヤー編集のみ）」を IndexedDB に保存。

## テスト（Playwright による実プレイ検証）

各スプリント末に、ヘッドレス Chromium（SwiftShader で WebGL2）で実際にゲームを
起動・操作し、`window.__game` デバッグ API とスクリーンショットで検証します。

```bash
npm run test:play   # 環境により PLAYWRIGHT_BROWSERS_PATH の設定が必要
```

`tests/play/sprint0..6.spec.ts` が各段階（起動/描画 → 操作・物理 → 地形生成 →
設置破壊 → 照明 → セーブ）をカバーします。

## スプリント進捗

- [x] Sprint 0: 足場 + ヘッドレス WebGL テスト基盤
- [x] Sprint 1: 単一チャンク描画（面カリング）
- [x] Sprint 2: 一人称操作・重力・ジャンプ・AABB 衝突
- [x] Sprint 3: 手続き的地形 + 多チャンクストリーミング
- [x] Sprint 4: ブロック設置/破壊（レイキャスト）+ 十字照準 + ホットバー
- [x] Sprint 5: フラッドフィル照明
- [x] Sprint 6: セーブ/ロード（IndexedDB）← 第一マイルストーン完成
- [ ] Sprint 7（任意）: 視錐台カリング、木、昼夜、Web Worker 化、グリーディメッシング 等
