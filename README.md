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
- **左クリック（押し続け）**: ブロック採掘（硬さに応じて時間がかかり、ヒビが進む）、**右クリック**: ブロック設置
- **1〜9**: ホットバーのスロット選択（採掘で集めたブロックを設置時に消費）
- **E**: インベントリ画面の開閉（2×2クラフト＋スロット移動）
- **作業台を右クリック**: 3×3クラフト / **かまどを右クリック**: 製錬（原料＋燃料→精錬）
  - 例: 原木→板材4、板材2→棒4、板材2×2→作業台、丸石8→かまど、丸石→(精錬)→石
  - ツール: 素材3＋棒2でツルハシ、素材3＋棒2で斧、素材1＋棒2でシャベル（木/石/鉄）
- **採掘とツール**: 石・丸石・かまどはツルハシが無いとドロップしない。適正ツールで採掘が速く、使うたび耐久が減り、0で壊れる。
- **G**: クリエイティブ⇔サバイバル切替（クリエイティブは無敵・即破壊）。サバイバルは落下/溶岩/溺水/奈落でダメージ、満腹で自然回復、空腹で餓死、死亡でスポーン地点へ復帰。HUD にハート/空腹を表示。

地形には木が生え、昼夜が約2分周期で巡ります。

### スマホ（タッチ）操作
タッチ端末では自動で画面上に操作 UI が出ます。
- 画面**左側をドラッグ**: 移動（フローティングジョイスティック）
- 画面**右側をドラッグ**: 視点
- **⛏ ボタン**: 破壊、**⬛ ボタン**: 設置、**⤒ ボタン**: ジャンプ
- 下部の**ホットバーをタップ**: ブロック選択

（PC でも `?touch=1` を付けるとタッチ UI を表示できます。）

## 公開（GitHub Pages）

`main` または開発ブランチへの push で、GitHub Actions が `dist/` を GitHub Pages へ
自動デプロイします（`.github/workflows/deploy.yml`）。

初回のみリポジトリ設定が必要です:
**Settings → Pages → Build and deployment → Source =「GitHub Actions」**

公開後の URL は `https://<ユーザー名>.github.io/minecraft_crone/` で、スマホの
ブラウザからそのまま遊べます。

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
- [x] Sprint 7: 木（決定論的構造物）＋ 昼夜サイクル
- [x] Sprint 8: スマホ対応（タッチ操作）＋ GitHub Pages 自動デプロイ
- [x] Sprint 9: ブロック硬度＋採掘時間（押し続け）・ヒビ表示・破壊/設置/足音
- [x] Sprint 10: ブロックドロップ＋アイテムエンティティ拾得＋インベントリ/ホットバー（9+27, スタック）
- [x] Sprint 11: クラフト（2×2＋作業台3×3）＋製錬（かまど）＋丸石/板材/棒/かまど等のアイテム
- [x] Sprint 12: ツール階層（木〜ダイヤのツルハシ/斧/シャベル）＝採掘速度・適正ツール・ドロップ可否・耐久
- [x] Sprint 13: サバイバル（体力20/空腹20・落下/溶岩/溺水/奈落ダメージ・自然回復・死亡/リスポーン・クリエイティブ切替・HUD）
- [x] Sprint 14: 流体（水/溶岩の流下・横方向への拡散）＋重力ブロック（砂/砂利の落下）
- [ ] 今後（任意）: Mob、洞窟生成、鉱石、Web Worker 化 等

> 視錐台カリングは Three.js が各メッシュの境界球で自動適用するため、チャンク単位で
> 既に効いています。
