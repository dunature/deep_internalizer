# **智能深度交互阅读器 (v2.0) \- 系统设计规范**

**Project Code:** Deep\_Internalizer

**Target User:** Single Personal User (Customized Habit Protocol)

**Core Philosophy:** Anti-Hoarding, Context-Anchored, Top-Down Processing

## **1\. 核心逻辑架构：双层漏斗模型 (The Two-Layer Funnel)**

本系统放弃线性的“平铺直叙”，采用符合人类认知加工的“自顶向下”双层结构。

### **Layer 0: Global Blueprint (全视之眼)**

* **触发时机**：文档导入 (Import) 完成后，进入阅读前的第一屏。  
* **功能定义**：  
  * **AI 智能分块 (Thematic Chunking)**：系统不按单纯的自然段切分，而是基于语义将文章划分为 N 个逻辑块（Chunk）。  
  * **逻辑地图**：展示文章的 Core Thesis（核心论点）及分块目录结构。  
  * **进度可视化**：每个 Chunk 显示当前完成度（如：Steps: 0/4）。  
* **交互价值**：建立宏观认知坐标系，防止用户在细节中迷失。

### **Layer 1: Segment Loop (分块闭环)**

* **触发时机**：用户点击 Layer 0 中的某个 Chunk。  
* **执行逻辑**：进入强制性的四步循环（Step 1-4）。只有完成当前 Segment 的所有步骤，Layer 0 的进度条才会更新。

## **2\. 核心功能模块详解**

### **模块 A：动态拦截式单词本 (The Vocabulary Gatekeeper)**

*对应需求：动态拦截、无复杂算法、语境回溯与脱离*

此模块是系统的“看门人”。旨在防止单词囤积，强制“还债”。

#### **A1. 启动拦截 (Launch Interception)**

* **逻辑**：App 启动时，检查 ReviewQueue（复习队列 \= 昨天的遗留 \+ 今日新增）。  
* **规则**：  
  * 若 Pending Words \> 0：主界面所有“阅读新内容”的入口**置灰锁定**。  
  * **唯一动作**：仅展示 "Clear Context Debt"（清理语境债务）按钮。  
* **例外**：提供隐藏的“紧急阅读”入口（每年限 3 次豁免权）。

#### **A2. A/B 语境验证机制 (Context-Switch Verification)**

复习单词时，拒绝枯燥的“词-义”对视，采用双卡片验证：

* **Card A (Anchor \- 锚定)**：  
  * 展示该单词在**最初阅读时所在的原文句子**（Original Source Context）。  
  * *功能*：唤醒情境记忆（"我当时是在哪里读到它的？"）。  
* **Card B (Transfer \- 迁移)**：  
  * 展示由 AI 生成或提取的**全新语境例句**（New Context）。  
  * *功能*：脱离验证（"换个句子我还能认出它吗？"）。  
* **操作流**：  
  * 用户先看 B 卡（测试是否掌握）。  
  * 若卡顿，向左滑动看 A 卡（回溯原文）。  
  * 底部按钮：Keep (保留) vs Archive (归档/掌握)。

#### **A3. 成就可视化 (The Heatmap)**

* **位置**：User Profile。  
* **形式**：GitHub 风格的绿色热力图。  
* **指标**：Date x (Segments Completed \+ Words Archived)。

### **模块 B：研读流程与 UI 关联 (The Segment Loop & Semantic Zoom)**

*对应需求：宏观优先、Step 2 溯源、UI 逻辑关联*

#### **B1. 顶部语义锚点 (The Semantic Anchor Bar)**

* **UI 组件**：屏幕顶部始终悬浮的面包屑导航。  
* **样式**：Global Map \> Chunk \#5 (The Problem) \> Step 2  
* **交互**：点击 Global Map 可随时展开 Layer 0 视图，确认当前位置。

#### **B2. Step 1: Macro Context (宏观概括)**

* **内容**：5-6 行的英文段落大意总结。  
* **目标**：仅做逻辑打底，不进行单词交互，建立粗颗粒度认知。

#### **B3. Step 2: Vocabulary Build (语义内化 \- 升级版)**

* **数据源**：关键词由系统从**原文 (Original Text)** 中提取，而非从 Step 1 提取。  
* **核心交互 \- "Peek Origin" (一瞥原文)**：  
  * **操作**：在单词卡片下方，设置长按区域或图标。  
  * **反馈**：长按时，当前界面背景变暗，**浮层高亮显示**该单词在**原文**中的完整段落。  
  * **价值**：物理层面上建立“单词-原文”的视觉连接，满足“从原文中自动查找”的需求。

#### **B4. Step 3 & 4 (语音与语流)**

* 保持原方案设计（音标切片 \+ 句子跟读），作为听觉维度的强化。

### **模块 C：精密断点续传 (Precision State Persistence)**

*对应需求：暂停、继续学习*

#### **C1. 状态快照引擎 (Snapshot Engine)**

系统数据库需记录以下精细字段，而非简单的“已读/未读”：

{  
  "doc\_id": "uuid\_12345",  
  "current\_chunk\_index": 5,  
  "current\_step": "step\_3\_articulation",  
  "sub\_step\_progress": 2, // e.g., 第 2 个句子  
  "audio\_playback\_time": 14.5, // 音频播放秒数  
  "scroll\_position": 450 // 像素高度  
}

#### **C2. 首页“继续”入口 (Resume Card)**

* **UI**：App 首页顶部展示 "Current Session" 卡片。  
* **逻辑**：点击后，毫秒级还原上述快照状态，无需从头加载音频或动画。

## **3\. 认知重构记录 (Cognitive Reconstruction)**

本设计方案基于以下思维模型的升级而定型：

| 维度 | 原初假设 | 最终方案 (v2.0) | 升级理由 |
| :---- | :---- | :---- | :---- |
| **复习机制** | **算法驱动**：依赖艾宾浩斯曲线调度复习。 | **直觉驱动**：Context-Switch (原文 vs 新例句) 验证。 | 相信“语境迁移能力”优于“时间间隔记忆”；减少算法黑箱带来的被动感。 |
| **阅读路径** | **线性解锁**：逐段解锁，视野受限。 | **双层漏斗**：Layer 0 (地图) \-\> Layer 1 (巷战)。 | 符合认知心理学的 Top-Down 加工模式；先见森林，再见树木。 |
| **单词管理** | **静态收藏**：单词本作为仓库。 | **动态拦截**：单词本作为“新内容的入场券”。 | 利用损失厌恶 (Loss Aversion)，强迫处理积压债务，防止“假性学习”。 |
| **关联性** | **步骤流**：Step 1 \-\> Step 2 的简单跳转。 | **全息透视**：Step 2 可随时“透视”回原文 (Peek Origin)。 | 强化“单词服务于原文”的从属关系，而非割裂的孤岛。 |

## **4\. 启发与反思 (Heuristic Reflection)**

* **Trade-off (取舍)**：为了保证**深度 (Depth)** 和 **连贯性 (Coherence)**，本方案牺牲了 **随意性 (Casualness)**。用户无法在未清理旧单词的情况下开启新篇章，这可能会在疲惫时产生阻力，但这是为了对抗“浅阅读”必须支付的代价。  
* **Growth (成长)**：当热力图逐渐填满，用户收获的不仅是词汇量，更是一套\*\*“不欠债、重语境、看全貌”\*\*的高级思维习惯。