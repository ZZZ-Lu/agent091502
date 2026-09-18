# Canvas / WebGL 图像全量渲染架构设计方案

## 1. 背景与目标
在无限画布（Infinite Canvas）中，随着生成节点和卡片数量增加，基于传统 DOM（`<img />`、`<motion.img />`）的混合渲染模式会遇到严重的性能瓶颈：
1. **DOM 节点与合成层爆炸**：每一张卡片的多层 `<img>` 标签会产生独立的 Compositor Layer，引发大量显存开销与同步重排（Synchronous Reflow）。
2. **多层级 LOD 割裂**：远景（Nano LOD，`scale < 0.60`）采用全屏 Canvas 绘制，而近景（Micro / Full / Original）采用 DOM 渲染，跨临界点缩放时触发 DOM 树的销毁与重建（DOM Thrashing）。
3. **高分辨率原图切换闪烁**：当镜头放大（`scale > 2.0`）切换至超清原图时，DOM 节点的替换和透明度过渡容易造成帧率波动。

**核心目标**：
将 **Micro（微缩/缩略图）**、**Full（标准预览图）** 与 **原图（超清原图）** 的所有图像呈现逻辑全面收口至 Canvas 渲染管线，消除 DOM `<img>` 标签，实现平滑的三级纹理渐进式加载（Progressive Streaming），并在缩放与拖拽期间严格贯彻「**意图驱动懒恢复 (Intent-Driven Lazy Restoration)**」。

---

## 2. 图像三级渲染管线设计 (Three-Tier Pipeline)

| 阶段 | 图像分辨率 | 数据源属性 | 触发条件 | Canvas 渲染策略与行为 |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Micro (微缩图)** | ~64px JPEG / WebP | `card.thumbnailUrl` 或 `thumbCache` | 卡片初始化、远景模式或 Full 尚未加载完毕 | 100% 内存常驻缓存，零延迟绘制底图，通过 Object-Cover 居中裁剪，支持平滑模糊插值，杜绝白块。 |
| **Tier 2: Full (标准图)** | 1024~2048px | `card.imageUrl` | 卡片处于可见视口（近景 `scale >= 0.60`） | 异步非阻塞加载与位图解码，完成时通过 requestAnimationFrame 平滑 cross-fade 覆盖 Micro，保证 60fps。 |
| **Tier 3: Original (原图)** | 4K ~ 10000px | `card.originalImageUrl` | `scale > 2.0` 且与视口中心相交，并在相机静止 300ms 后 | 按需将高分辨率位图绘制至自适应 DPR 的 Canvas 缓冲区；缩放或平移瞬间**立即降级为 Full**；采用 LRU 缓存池限制激活数量，防止 GPU 显存崩溃（Context Loss）。 |

---

## 3. 分层渲染与架构解耦 (Data-DOM Decoupling)

依照项目最高架构约束，业务数据与渲染层实现物理隔离：

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. 业务数据层 (Pure Serializable Model)                      │
│ - CardData: { id, x, y, width, height, imageUrl, ... }      │
│ - 全局纯数据对象，禁止存放 Canvas/Image/DOM 实例             │
├─────────────────────────────────────────────────────────────┤
│ 2. 纹理与缓存管理层 (imageTextureCache / LRU)                │
│ - 独立于组件生命周期的内存纹理池                             │
│ - 提供 getOrLoadImage()、evictOriginal()、isImageLoaded()   │
├─────────────────────────────────────────────────────────────┤
│ 3. 图像渲染适配层 (CardImageCanvas & NanoLodCanvas)          │
│ - Micro: NanoLodCanvas (全景批量 2D Canvas)                 │
│ - Full & Original: CardImageCanvas (<canvas> 硬件加速渲染)  │
│ - 纯数学计算 Object-Cover 坐标与 Squircle 连续曲率裁剪      │
├─────────────────────────────────────────────────────────────┤
│ 4. DOM 交互外壳 (Lightweight Overlay)                        │
│ - 仅负责：拖动手柄、文本输入区 (<textarea>)、菜单按钮       │
│ - 不包含任何 <img> 图像元素                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 意图驱动懒恢复在图像 Canvas 上的实施机制

1. **运动中持久降级 (Persistent Degradation)**：
   - 监听相机 MotionValue（`tx, ty, scale`），一旦检测到缩放或平移，立即将 `showOriginal` 置为 `false`，Canvas 仅渲染已缓存的 Full 或 Micro 纹理，禁用昂贵的动态滤镜与重绘。
2. **一级意图触发器 (Instant Restoration)**：
   - 当用户停止缩放并执行点击选择、准备编辑时，立即以 0ms 过渡恢复高质量渲染。
3. **终极托底 (Absolute Idle Fallback)**：
   - 相机静止 300ms 且处于视口中心焦点时，才触发 Original 原图的 Canvas 上传与渲染。

---

## 5. 内存管理与稳定性防护

1. **限制 Original 显存占用**：
   - 原图纹理通过 LRU 队列管理，当视口移开或缩小后，自动解除引用；
2. **连续曲率 Squircle 离屏路径**：
   - 在 Canvas 上通过超椭圆公式（Lamé curve）或贝塞尔高次拟合直接绘制真实 Squircle 连续曲率路径进行裁剪，避免 CSS `border-radius` 与 GPU 合成冲突；
3. **支持 Retina / 高 DPR 渲染**：
   - Canvas 物理像素自动对齐 `window.devicePixelRatio`（原图模式下上限对齐当前 scale，最大 3.5），保证超高分辨率放大时的丝滑锐利显示。
