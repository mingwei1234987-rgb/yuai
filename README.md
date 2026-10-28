# 雨爱（司凤版）· Folia 风格播放器

界面复刻自 [chthollyphile/folia-major](https://github.com/chthollyphile/folia-major)（"Lyrics Reimagined" 全屏沉浸式播放器）的视觉语言：午夜墨染底色 `#09090b`、Inter/Noto Sans 字体栈、毛玻璃右侧面板、底部胶囊控件、Mesh 渐变背景、逐词发光歌词。

中央旋转蹦哒的主角是 `assets/aaa.gif`，曲目固定为 `audio/yuai.mp3`，歌词在 `lyrics/yuai.lrc`。

## 使用

浏览器安全策略要求经本地服务器打开（file:// 下 Web Audio 取不到频谱）：

```powershell
cd d:\作业\music-player
D:\PsychoPy2\python.exe -m http.server 8000
```

访问 http://localhost:8000 ，点击页面中央播放按钮开始。

## 动效原理

| 表现 | 驱动来源 |
| --- | --- |
| 持续旋转 | 整体音量 RMS + 中频（旋律）能量，能量越高转越快 |
| 踩点蹦哒 | 20–150Hz 低频能量 vs 近 48 帧滑动均值的突变检测（自适应阈值 + 230ms 去抖），鼓点处旋转加速 + 上蹦 |
| 逐词歌词 | LRC 行时间按词长分配词级时间戳，当前行放大 1.3 倍 + 逐词发光（`text-shadow` 双层辉光），非当前行模糊压暗 |
| 背景配色 | 从 aaa.gif 首帧提取主色（HSV 分桶），注入 `--c1/--c2/--c3`，Mesh 渐变随节拍呼吸 |
| 底部波形 | `AnalyserNode` 时域数据绘制镜像色带 |
| BPM | 取最近节拍间隔的中位数换算 |

## 歌词时间轴来源

本地音频（Settle一虾子《雨爱》，138.45s）在网易云/QK 均无现成 LRC。时间轴通过 **chroma DTW** 推导：下载原版《雨爱》（杨丞琳，网易云 5235487）作参考，计算两首歌的色度特征序列做动态时间规整，把原版 LRC 的每个时间点弯曲映射到本地音频；后半段与网易云 138 秒 Live 版 LRC 的结构互相印证（误差 <1.5s）。

## 快捷键

- `空格`：播放 / 暂停
- `←` / `→`：快退 / 快进 5 秒
- `M`：静音
