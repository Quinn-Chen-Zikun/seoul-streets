# 首尔街头

步行或驾车探索首尔的三维开放城市，穿越街巷与汉江两岸，体验昼夜变化和街头故事。

[开始游玩](https://quinn-chen-zikun.github.io/seoul-streets/)

直接打开 `index.html`，或通过任意静态服务器访问。整个 `repo/` 可直接部署到 GitHub Pages，无需安装依赖或构建。三维引擎从 CDN 加载，需要网络连接；`single.html` 是相同内容的单文件版本，也保留相同 CDN 依赖。

## 操作

| 按键 | 功能 |
| --- | --- |
| WASD | 移动 / 驾驶 |
| 鼠标移动 / 右侧拖动 | 环顾；点击画面锁定视角，Esc 释放 |
| 滚轮 | 缩放视角 |
| Shift；C / Caps Lock | 疾跑；切换步行 |
| Space | 跳跃 / 手刹 / 跳过剧情镜头 |
| F；E | 上下车 / 进门；对话 / 收集 / 商店交互 |
| 左键；右键 | 攻击；瞄准 |
| 1–3 / Q；R；H | 选择 / 切换武器；换弹；收起武器 |
| N；J；M；K | 全城地图；任务日志；切换支线；换装 |
| B；T；V | 镜头起伏；切换时刻；湿滑路面 |

手机和平板使用左侧摇杆移动、右侧滑动环顾，以及屏幕上的操作按钮。

## 项目结构

```text
repo/
├── index.html       页面入口与界面结构
├── single.html      可单独分发的合并版本
├── css/style.css    全部静态样式
└── js/
    ├── core.js        命名空间、配置与初始化调度
    ├── renderer.js    渲染、天空、光照与天气
    ├── materials.js   纹理、材质与几何辅助
    ├── world.js       地形、道路与碰撞
    ├── buildings.js   建筑、地标与室内
    ├── props.js       植被、街道设施与景物
    ├── characters.js  人物骨架、步态与移动
    ├── vehicles.js    车辆、驾驶与交通
    ├── combat.js      武器、战斗与音效
    ├── population.js  行人、目击与通缉
    ├── missions.js    剧情、任务、换装与存档
    ├── shops.js       商店、店员与交易
    ├── hud.js         界面提示与地图
    ├── input.js       输入、设置与开始事件
    └── main.js        镜头、模拟循环与启动
```

脚本按 `index.html` 中的顺序加载，使用 `window.SN` 共享状态。各文件先注册函数，再由 `main.js` 按编号执行初始化阶段，保留场景、对象和事件的创建顺序。修改初始化编号时需保持依赖顺序。

在项目父目录运行 `node repo-check/check.js` 检查脚本，运行 `node repo-check/build-single.js` 更新单文件版本；这些是可选维护命令，游玩和部署无需执行。
