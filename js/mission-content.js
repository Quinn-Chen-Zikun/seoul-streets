/* 账本风波与白鸥之下：章节、目标、对白及街头工作配置。 */
"use strict";
(function (SN) {
  SN.registerInit(25.5, function initializeStoryContent() {
    const go = (text, x, z, extra = {}) => Object.assign({ type: "go", text, x, z, r: 7 }, extra);
    const collect = (text, x, z) => ({ type: "collect", text: text + " · E 收取", x, z, r: 3 });
    const fight = (text, x, z, count, melee = false) => ({ type: "fight", text, x, z, count, melee });
    const drive = (text, x, z, extra = {}) => Object.assign({ type: "drive", text, x, z, r: 12 }, extra);
    const escape = heat => ({ type: "escape", text: "离开搜索圈，摆脱 " + heat + "★ 通缉", heat, seconds: 180 });
    const vehicle = (text, x, z, vehicleType, extra = {}) => Object.assign({ type: "vehicle", text, x, z, vehicleType, r: 6 }, extra);
    const chase = (text, x, z, route) => ({ type: "chase", text, x, z, route });
    const race = (text, x, z) => ({ type: "race", text, x, z, r: 17 });
    const boatRace = (text, x, z) => ({ type: "race", text, x, z, r: 22, boat: true });
    const mission = (id, title, giver, district, x, z, reward, brief, dialogue, objectives, extra = {}) => Object.assign({
      id, title, giver, district, start: { x, z }, reward, respect: Math.round(reward / 20),
      brief, dialogue, objectives, limit: 360, totalLimit: 360,
      fail: "倒下、被捕或超时即失败；车辆及护送目标须完好，失败可立即重试检查点。",
      outro: "证据已交接。下一位联系人已在地图标记。"
    }, extra);
    const first = SN.storyMissions[0];
    first.brief = "韩序温请初到首尔的你送一份货单。先学会走街、开车与自保，再决定替谁跑下一趟。";
    first.dialogue = ["韩序温：首尔不会替新人留位置。先把送货单对清楚，别急着站队。", "韩序温：记下人说的话，也留下纸上的证据。两者未必一样。"];
    first.totalLimit = 360;
    SN.storyMissions[1].totalLimit = 480;
    SN.storyMissions[2].totalLimit = 600;
    SN.storyMissions[2].limit = 600;
    // Keep the observation point beside a drivable avenue, outside the pedestrian shopping strip.
    for (const o of SN.storyMissions[1].objectives) {
      if (o.type === "go" && !o.contact) { o.x = 578; o.z = -444; }
      if (o.type === "tail") { o.x = 620; o.z = -430; o.route = [[760, -430], [760, -640], [560, -640], [560, -430]]; }
    }
    first.objectives = [
      go("走到便利店门口", -39, -778, { r: 3, hint: "WASD / 左摇杆移动 · Shift / 疾跑加速" }),
      vehicle("进入街边准备好的出租车", -66, -786, 3, { hint: "靠近车辆按 F / 上车按钮" }),
      drive("驾车把送货单送到咖啡店街口", 34, -637, { hint: "W 加速 · S 刹车倒车 · 空格 / 手刹转弯" }),
      fight("下车击退两名堵路打手", 34, -609, 2, true),
      escape(1),
      go("回钟路将单据交给韩序温", -30, -765, { contact: "mentor", r: 3 })
    ];
    first.objectives[3].hint = "F 下车 · 左键 / 攻击挥拳 · H / 收枪恢复徒手";
    first.objectives[4].hint = "驶离红圈并躲开巡警视线 · 星星闪烁后逐渐消失";
    // Preserve the first campaign and its checkpoint indices for existing saves.
    SN.storyMissions[1].giver = "detective";
    SN.storyMissions[2].giver = "informant";
    SN.storyMissions[5].giver = "mentor";
    SN.storyMissions[6].id = "ledger";
    SN.storyMissions[6].outro = "原始账本交给了尹海率，两帮撤掉收费牌。三个月后，一份白鸥物产的配送合同把你重新带回街头。";
    SN.storyMissions[3].objectives.splice(3, 0,
      collect("梨泰院坡道街口的配送记录", -1100, -100),
      collect("南山观景路的签收底页", -320, -180));
    SN.storyMissions.push(
      mission("valet", "08 · 代客", "mentor", "江南 · 清潭洞", 560, 920, 800,
        "一次代驾，把别人的车和别人的命运一起开走。白色跑车里留着一份墨还没干的合同。",
        ["韩序温：代驾的第一课：客人记得车，不记得你。", "韩序温：07 号钥匙。开到圣水，别刮，别问。"], [
          collect("从泊车架取 07 号钥匙", 580, 920),
          vehicle("开走白色折光跑车", 560, 945, 7, { contract: true }),
          drive("把跑车和合同送到圣水", 1850, -450, { contract: true, minHealth: 65 }),
          escape(1)
        ], { outro: "韩序温：有人刚替别人决定了命运。放着，等它自己发臭。" }),
      mission("market", "09 · 夜市", "informant", "钟路 · 广藏市场", 902, -674, 1200,
        "一箱「泡菜」穿过广藏市场，里面是三十七份租约。蓝马甲稽查已经等在北门。",
        ["蔡娜凛：这箱子写着「泡菜」，里面是三十七份租约。", "蔡娜凛：加了白鸥的违约金，当然重。"], [
          collect("取走标着泡菜的租约箱", 906, -672),
          go("100 秒内把租约送到北门商会", 900, -790, { seconds: 100 }),
          fight("击退三名蓝马甲稽查", 900, -790, 3, true),
          collect("收下商会盖章的回执", 918, -790)
        ]),
      mission("taillight", "10 · 尾灯", "detective", "明洞 · 乙支路", 378, -444, 1600,
        "跟住一辆太准时的货车。不要贴车、不要开枪，把重复的配送路线记下来。",
        ["尹海率：太准时的人，通常在做两件事：上班，和撒谎。", "尹海率：我要后一件的证据。保持三个车位。"], [
          go("抵达明洞观察点", 378, -444),
          { type: "tail", text: "跟住货车 40 秒 · 保持 18–85 米", x: 416, z: -430, duration: 40,
            route: [[760, -430], [760, -640], [360, -640], [360, -430]] },
          collect("收集配送货车留下的卸货单", 778, -620)
        ], { outro: "尹海率：收货人是一家不存在的公司。" }),
      mission("emptycar", "11 · 空车", "informant", "弘大", -1900, -540, 2100,
        "蓝马甲把债务写成配送费。到弘大后巷取回欠款与路线卡。",
        ["蔡娜凛：先去吵架。他们喝了酒，吵架比偷东西快。", "蔡娜凛：标题我想好了：「最后一公里，最后一拳」。"], [
          go("到弘大夜店后巷", -1830, -540),
          fight("追讨欠款，击退五名配送员", -1830, -540, 5, true),
          collect("取下跑车中的路线卡", -1845, -540), escape(2)
        ]),
      mission("awning", "12 · 雨棚", "mentor", "东大门 · DDP", 1300, -640, 2700,
        "守住修鞋摊的雨棚和尊严。蓝马甲和银光团硬派带着封条赶来了。",
        ["韩序温：雨棚是租的，手艺是自己的。", "韩序温：带上扳手。道理有时候需要附件。"], [
          go("到 DDP 夜市雨棚区", 1330, -640),
          { type: "defend", text: "守住修鞋摊 60 秒", x: 1330, z: -640, duration: 60, supply: 2 },
          { type: "escort", text: "步行护送韩序温离开夜市", x: 1430, z: -640, from: [1330, -640], duration: 60, r: 6 }
        ], { costume: "ash" }),
      mission("ferry", "13 · 摆渡", "detective", "汝矣岛 → 梨泰院", -1370, 520, 3400,
        "把前财务经理闵世萝带到安全街口。警车在桥头搜索，证人需要完好的出租车。",
        ["尹海率：她发现公司把火灾写进了收益栏，就觉得该换个老板。", "尹海率：出租车。最不起眼的那种。"], [
          vehicle("取用渡口的出租车", -1370, 540, 3),
          { type: "taxiPickup", text: "停稳，接闵世萝上车", x: -1370, z: 520, r: 12 },
          drive("保护证人，驶过汉江到梨泰院", -1110, -80, { escortCar: true, heat: 3, minHealth: 30 }),
          escape(3), go("带证人到安全街口", -1190, -80)
        ]),
      mission("fakeplate", "14 · 假牌", "informant", "江南", -150, 980, 4200,
        "投标副本在假牌轿车里。追停它，保住后备箱里的纸，再甩开巡警。",
        ["蔡娜凛：真牌不会一周被三辆车用。车管所还没那么幽默。", "蔡娜凛：别撞后备箱。文件不疼。"], [
          go("到家具街观察黑车", -145, 1050),
          chase("追停假牌轿车 · 车况降至 35%", -130, 1020, [[-130, 1060], [560, 1060], [560, 900], [-130, 900]]),
          { type: "collect", text: "下车取投标副本 · E", x: -130, z: 1020, fromTarget: true, r: 5 }, escape(3)
        ]),
      mission("meeting", "15 · 堂会", "detective", "圣水 → 江南", 1900, -412, 5200,
        "三方在旧仓库密谈，撤离车队会把录音带到江南夜店。截住车队，取回握手交易的证据。",
        ["尹海率：三方的共同点？都觉得自己在骗另外两方。", "尹海率：装一个录音器，拍一张握手。剩下的交给他们的贪心。"], [
          collect("取走首尔林仓库外的录音器", 1870, -430),
          { type: "ambush", text: "伏击撤离车队 · 逼停车队领车", x: 1850, z: -440,
            route: [[1850, -180], [2100, -180], [2100, -440], [1850, -440]] },
          go("赶往江南夜店的交接点", 400, 970),
          fight("夜店交火 · 击退六名守账人", 400, 970, 6),
          collect("带走三方握手的录音", 410, 970), escape(3)
        ], { unlock: 4 }),
      mission("drone", "16 · 空拍", "informant", "蚕室 · 石村湖", 2720, 1860, 6500,
        "坠落存储卡记录了三十七箱退租通知。把它从白鸥安保队手里带回蚕室站。",
        ["蔡娜凛：三十七箱退租通知，和一箱烧焦的账本。", "蔡娜凛：拍下来，能让读得懂的人闭嘴。"], [
          collect("在石村湖岸取回空拍存储卡", 2780, 1850),
          fight("击退六名白鸥安保", 2780, 1850, 6),
          drive("带存储卡到蚕室站", 2460, 1440, { heat: 4 }), escape(4)
        ]),
      mission("bridge", "17 · 断桥", "mentor", "汉江 · 盘浦大桥", -150, -30, 8200,
        "在桥面计时赛中抢到出口，截住载有拆除许可原件的货车。",
        ["韩序温：桥是直的，人是弯的。别跟他抢道，抢出口。", "韩序温：赢了，许可留下。输了，下周改行卖鱼糕。"], [
          vehicle("进入桥赛准备车", -130, -30, 7),
          race("桥赛检查点 1 · 北引桥", -130, 30),
          race("桥赛检查点 2 · 汉江中央", -130, 460),
          race("桥赛检查点 3 · 南引桥", -130, 900),
          chase("截住南岸许可货车", -130, 1040, [[560, 1060], [560, 900], [-130, 900], [-130, 1060]]),
          { type: "collect", text: "取走拆除许可原件 · E", x: -130, z: 1040, fromTarget: true, r: 5 }
        ], { totalLimit: 240 }),
      mission("gull", "18 · 白鸥", "detective", "汝矣岛 · 63 大厦", -840, 530, 11000,
        "从 63 大厦的晚宴交接箱取走投标信封，驾车冲出四星封锁。",
        ["尹海率：慈善晚宴，主题叫「共享城市」。", "尹海率：以代客泊车身份进去。这很合适。"], [
          go("到 63 大厦晚宴入口", -840, 530),
          collect("从代驾交接箱取信封", -840, 548),
          vehicle("进入接应轿车", -850, 560, 1),
          drive("驾车冲出封锁到南岸", -700, 1080, { heat: 4 }), escape(4)
        ], { outro: "三十七个签名，十二种笔迹。一只右手替他们做了决定。" }),
      mission("dawn", "19 · 天亮", "mentor", "钟路 · 光化门", -30, -765, 30000,
        "守住世宗大王像后的转播车，交出原件，再追停陈鹤守的车。让合同见光。",
        ["韩序温：记者在光化门等你。律师后面，通常站着不该站的人。", "韩序温：守住到天亮。天亮之后，这事就不归我们管了。"], [
          go("在光化门广场会合", -60, -790),
          { type: "defend", text: "守住转播车 90 秒", x: -60, z: -790, duration: 90, supply: 2 },
          collect("把原件交给记者", -45, -790),
          chase("追停陈鹤守的轿车", 20, -800, [[360, -800], [360, -640], [-130, -640], [-130, -800]]),
          escape(5)
        ], { costume: "dawn", outro: "投标撤了，市场还在。韩序温：上车吧。今天你只是代驾，送我回家。" })
    );
    SN.sideJobs.push(
      mission("scooter", "배달 · 破晓配送", "informant", "广藏市场", 940, -640, 900,
        "骑外卖踏板车，在 90 秒内把三份急件送到街口。", ["蔡娜凛：名字很客气，时间不客气。"], [
          drive("配送 1 / 3 · 市场南口", 760, -640, { vehicleType: 8 }),
          drive("配送 2 / 3 · 明洞北口", 360, -640, { vehicleType: 8 }),
          drive("配送 3 / 3 · 乙支路", -130, -640, { vehicleType: 8 })
        ], { requiredVehicle: 8, totalLimit: 90 }),
      mission("vigilante", "街区巡查", "detective", "钟路", 360, -800, 1200,
        "驾驶警车追停运送假证的车辆，取回文件。目标车必须保留。", ["尹海率：我要的是原始记录。"], [
          chase("追停假证车 · 勿摧毁", 416, -800, [[760, -800], [760, -640], [360, -640], [360, -800]]),
          { type: "collect", text: "下车收回假证 · E", x: 416, z: -800, fromTarget: true, r: 5 }
        ], { requiredPolice: true, totalLimit: 180 }),
      mission("rampage", "市场看场 · 限时挑战", "informant", "明洞", 450, -330, 1300,
        "90 秒内击退六名堵路成员，为摊位留出通道。", ["蔡娜凛：最后一公里，最后一拳。"], [
          fight("90 秒内击退六名堵路成员", 450, -330, 6)
        ], { totalLimit: 90 }),
      mission("bridge_circuit", "汉江三桥夜赛", "mentor", "汉江", -130, -30, 2600,
        "沿三座桥依次过点。全程计时，抵达终点结算。", ["韩序温：桥是直的，人是弯的。"], [
          race("盘浦大桥南端", -130, 900), race("汉南大桥南端", 560, 900),
          race("汉南大桥北端", 560, -40), race("圣水大桥北端", 1900, -40),
          race("圣水大桥南端 · 终点", 1900, 900)
        ], { requiresCar: true, totalLimit: 240 }),
      mission("nightshift", "夜班代驾 · 弘大", "mentor", "弘大", -30, -765, 1500,
        "韩序温把一单夜班代驾转给你：客人在弘大夜店喝到站不稳，车却是一辆新跑车。把人送回江南，车漆一块都不能少。",
        ["韩序温：代驾的第二课：客人醉了，车没醉。", "韩序温：弘大门口那辆白车，钥匙在客人手里。先看车，再看他。"], [
          go("到弘大夜店门口接客人", -1867, -566, { r: 6 }),
          vehicle("接手客人的白色跑车", -1863, -562, 7, { contract: true }),
          drive("把客人送回江南车行", -170, 1075, { contract: true, minHealth: 55, r: 14 })
        ], { totalLimit: 480, outro: "客人多给了小费，坚持说自己没醉。韩序温：钱收下，话别信。" }),
      mission("riverside", "汉江夜巡", "detective", "汉江", 346, -752, 1400,
        "北岸的夜巡记录少了一页，沿着江边找到残页，再送到南岸治安站归档。",
        ["尹海率：今晚北岸的巡逻记录少了一页，找到它。", "尹海率：别走大路，南岸治安站有人在等。"], [
          go("到汉江北岸巡防点", -600, -30, { r: 8 }),
          collect("收取遗落的巡逻记录", -600, -30),
          drive("把记录送到南岸治安站", 560, 930, { r: 14 })
        ], { totalLimit: 420, outro: "记录补回了档案。尹海率在收据背面写了两个字：先别声张。" }),
      mission("clubsecurity", "夜店看场", "informant", "弘大", 902, -674, 1200,
        "弘大夜店有人喝多了闹事，替店长把人请出去，工钱现结。",
        ["蔡娜凛：弘大夜店今晚缺个看场的，工钱现结。", "蔡娜凛：别打坏镜子，那面比你的工钱贵。"], [
          go("到弘大夜店门口找店长", -1867, -570, { r: 6 }),
          fight("击退三名闹事醉客", -1867, -570, 3, true),
          go("回吧台拿看场费", -1860, -560, { r: 4 })
        ], { totalLimit: 240, outro: "店长把现金塞进你手里，顺便把闹事者的酒钱也记在你头上。" }),
      mission("riverrun", "汉江快艇赛", "mentor", "汉江", -30, -765, 1600,
        "开快艇沿汉江中段穿过四道浮标，全程计时；撞桥墩或开上岸都会中断比赛。",
        ["韩序温：江面比马路宽，也比马路不讲道理。", "韩序温：船在东南岸边，四道浮标，别把螺旋桨缠了。"], [
          go("到汉江东南岸找一艘快艇", 1450, 862, { r: 9 }),
          boatRace("浮标 1 · 东段", 1400, 450),
          boatRace("浮标 2 · 中段", 1000, 450),
          boatRace("浮标 3 · 桥下", 600, 450),
          boatRace("浮标 4 · 终点", 200, 450)
        ], { totalLimit: 320, outro: "你把船靠回岸边，韩序温在电话里只说了句：别把螺旋桨缠了。" }),
      mission("airport", "机场夜班", "informant", "江西 · 金浦机场", 902, -674, 1500,
        "把一只贴着夜班标签的箱子从金浦机场送到首尔站，别问里面是什么。",
        ["蔡娜凛：机场那边只认提货码，不认脸。", "蔡娜凛：箱子别放后备箱，放副驾，它怕颠。"], [
          drive("到金浦机场货运口", -2300, -1500, { r: 15 }),
          collect("取走夜班标签的箱子", -2300, -1500),
          drive("把箱子送到首尔站", -1115, -430, { r: 15 })
        ], { totalLimit: 480, outro: "箱子交接完，手机收到一条没有署名的转账。" }),
      mission("bukchon", "北村夜访", "detective", "钟路 · 北村", 346, -752, 1300,
        "有人把一支录音笔塞进北村老宅的门缝，取回来，别惊动住户。",
        ["尹海率：北村的墙比人耳朵多。", "尹海率：拿到了就回来，别在巷子里开手电。"], [
          go("到北村巷口", 360, -1360, { r: 6 }),
          collect("从门缝取回录音笔", 360, -1360),
          go("回光化门把录音笔交给尹海率", 346, -752, { r: 4 })
        ], { totalLimit: 360, outro: "录音笔里只有一段雨声。尹海率说，够了。" }),
      mission("turf", "地盘交涉", "mentor", "明洞", -30, -765, 1700,
        "银光团把看场费算到了代驾客人头上，去明洞把话说明白。",
        ["韩序温：有些账不能写进收据。", "韩序温：先让他们把话说清楚，再决定要不要动手。"], [
          go("到明洞银光团地盘", 450, -330, { r: 8 }),
          fight("击退四名看场成员", 450, -330, 4, true),
          go("回乙支路找韩序温", -30, -765, { r: 4 })
        ], { totalLimit: 300, outro: "看场费退了，收据背面多了一行手写的『下不为例』。" })
    );
    for (const [i, m] of SN.storyMissions.entries()) {
      m.district = m.district || ["钟路 · 光化门", "明洞", "江南", "首尔 · 南山", "乙支路", "汉江", "汉江"][i];
      m.respect = m.respect || Math.round(m.reward / 20);
      m.totalLimit = m.totalLimit || m.limit || 360;
      m.next = SN.storyMissions[i + 1] ? [SN.storyMissions[i + 1].id] : [];
    }
    // Travel-heavy evidence gathering needs time for bridges, parking and collection.
    SN.storyMissions.find(m => m.id === "papertrail").totalLimit = 600;
    SN.storyMissions.find(m => m.id === "meeting").totalLimit = 480;
    SN.campaign.jobWins = SN.sideJobs.map(() => 0);
  });
})(window.SN);
