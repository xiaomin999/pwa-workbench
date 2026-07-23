#!/usr/bin/env node
/* 个人全能自律工作台 — 选题真实联网抓取服务（零依赖，Node 18+ 原生 fetch）
 *
 * 运行： node fetch-server.js          （默认端口 3001，可用 PORT 环境变量改）
 * 前端： 设置 → 联网抓取 → 端点填  http://localhost:3001/api/topics
 *
 * 实时抓取：设置环境变量 HOT_API 指向你可靠的抖音/小红书热点 JSON 接口，
 *          接口返回 [{platform,title,url,heat,follow,remake}] 或 {items:[...]} 即可获得真实实时数据。
 *          未设置 HOT_API 时，服务返回内置真实种子库（带来源链接，按日轮转），保证端到端可用。
 */
const http = require('http');
const PORT = process.env.PORT || 3001;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

async function fetchJSON(url, referer){
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json, text/plain, */*', 'Referer': referer || 'https://www.toutiao.com/' }
  });
  return r.json();
}

function classifyMarket(title, content){
  const t = (title + ' ' + content);
  if (/LPR|货币|央行|降准|降息|利率|逆回购|MLF/.test(t)) return 'macro';
  if (/半导体|芯片|AI|人工智能|算力|机器人/.test(t)) return 'industry';
  if (/新能源|光伏|储能|电池|能源|算电/.test(t)) return 'industry';
  if (/消费|零售|以旧换新/.test(t)) return 'industry';
  if (/医药|创新药|基药/.test(t)) return 'industry';
  if (/军工|航天/.test(t)) return 'industry';
  return 'industry';
}

const DOUYIN = [
  {title:'26版西游记职场二创（白龙马行车记录仪视角）',url:'https://www.toutiao.com/a1871339928286340',heat:'高',follow:'用第一人称/行车记录仪视角拍职场一天，套用国民IP：唐僧=画饼领导、悟空=内卷员工、八戒=摸鱼、沙僧=老好人，主打打工人共鸣。',remake:'换成你行业的「师徒」人设（程序员版/教师版/销售版），讲你行业的真实职场梗，比泛职场段子更吸粉。'},
  {title:'叹气向上挑战（魔性BGM转旋律）',url:'https://www.toutiao.com/a1871339928286340',heat:'中',follow:'拍自己叹气被音效转成《特别的爱给特别的你》旋律的搞笑短片，零门槛翻拍。',remake:'结合你职业的「叹气名场面」（如改方案被毙/需求又变），做成系列反差搞笑。'},
  {title:'慢充旅行（小城慢游·青岛/威海/昆明/汕尾/泉州）',url:'https://www.163.com/news/article/L1UTRQE000019UD6.html',heat:'高',follow:'拍一座小城的慢日常：海风/菌子火锅/簪花/渔港，睡到自然醒走到哪吃到哪。',remake:'做你所在城市的「慢充」路线，几十块收获一整天的满足感，避开特种兵式赶路。'},
  {title:'丑鱼/比奇堡转场（抖音转场素材19亿播放）',url:'https://www.toutiao.com/article/7662732359606747700',heat:'高',follow:'用歪嘴丑鱼作为不同场景之间的转场素材，衍生旅游打卡/日常反差类二创。',remake:'换成你自己的IP形象或道具做转场，把「丑萌反差」迁移到你的内容里。'},
  {title:'跟着抖音网友吃一天（一日菜单+预算+真实评价）',url:'https://neodrop.ai/ko/post/OEqkBVIr7r_',heat:'高',follow:'做「一日菜单+预算记录+真实评价」的跟拍，价格和店铺只写实测结果。',remake:'做你城市的「跟着吃一天」，只拍本地人常去的小店，价格真实不虚标。'},
  {title:'第一眼直觉点评穿搭（颜色/比例/场景三判断点）',url:'https://neodrop.ai/ko/post/OEqkBVIr7r_',heat:'中',follow:'把直觉拆成颜色、比例、场景三个判断点点评路人穿搭，征得出镜者同意。',remake:'把「直觉点评」迁移到你专业领域（如家居/妆容/产品），做成固定栏目。'},
  {title:'世界杯夜宵热潮（烧烤/啤酒/夜市团购）',url:'https://www.toutiao.com/a1871339928286340',heat:'中',follow:'蹭赛事流量拍球赛夜宵探店、深夜美食、夜市团购。',remake:'做你城市的「夜宵地图」系列，按区域/品类分集，长期可接本地商家。'},
  {title:'入伏三伏养生饮食（40天时间表/避暑清单）',url:'https://neodrop.ai/zh-cn/post/XqPGlWsk-Vg',heat:'高',follow:'把入伏写成「今天能执行的一件事」：吃什么、跑不跑、如何安排40天、高温应对。',remake:'做「一家人的入伏饮食清单」「高温天还要不要跑步」，把节气拆成具体场景。'},
  {title:'人形机器人格斗赛（名场面逐帧复盘）',url:'https://neodrop.ai/ko/post/OEqkBVIr7r_',heat:'中',follow:'先解释比赛规则，再做名场面逐帧复盘，不凭标题推断现场原因。',remake:'用「格斗」比喻你行业的竞争/对线，科普+情绪双收。'},
  {title:'AI短剧/AI漫剧二创（西游AI/AI恋综）',url:'https://dy.163.com/article/L1NOCL090511DBV1.html',heat:'高',follow:'用AI工具做国民IP漫剧（西游二创最火），走连载+IP涨粉路线。',remake:'让AI生成你行业的短剧/漫剧，低成本日更，蹭AI内容流量红利。'},
  {title:'毕业季剧情（超能毕业汇演·离别情绪）',url:'https://www.163.com/dy/article/L1DCVR540511DBV1.html',heat:'中',follow:'拍毕业/离别/青春遗憾情绪叙事，多创作者联动共创。',remake:'把你行业的「毕业」主题（如离职/结业/项目收官）做成情绪短片。'},
  {title:'绿皮火车去拉萨（车窗视角旅行叙事）',url:'https://neodrop.ai/ko/post/OEqkBVIr7r_',heat:'中',follow:'做「车窗视角+行李清单+沿途片段」的慢旅行叙事。',remake:'把你的一段长途旅行做成车窗视角vlog，情绪+风景双线。'}
];
const XHS = [
  {title:'入伏+具体场景（三伏时间表/养生/饮食清单）',url:'https://neodrop.ai/zh-cn/post/XqPGlWsk-Vg',heat:'高',follow:'今天更值得跟的是「入伏+具体场景」：把节气写成今天就能执行的一件事。',remake:'做你的「入伏第一周怎么安排」「一家人的入伏饮食清单」，可保存可照做。'},
  {title:'准大学生/新生信息差（宿舍/开学必备/校园卡）',url:'https://neodrop.ai/zh-cn/post/XqPGlWsk-Vg',heat:'高',follow:'用学校或城市缩小信息差，做新生答疑、宿舍布局、开学必备。',remake:'做你专业的「入学清单」「新生避坑」，信息差=收藏量。'},
  {title:'暑假工城市避坑（日结/包吃住/风险）',url:'https://neodrop.ai/zh-cn/post/XqPGlWsk-Vg',heat:'高',follow:'先讲地点、年龄、工时和风险，再讲机会，比空喊「搞钱」更可信。',remake:'做你城市的「暑假工避坑」，真实案例+避坑清单。'},
  {title:'旅行+预算路线（云南7-9月/大理小众/人均）',url:'https://neodrop.ai/zh-cn/post/XqPGlWsk-Vg',heat:'高',follow:'用月份、路线和人均预算替代泛目的地种草，评论区才会接话。',remake:'做你的「小众路线+人均预算」，把决策型关键词（XX怎么选）写进标题。'},
  {title:'装修避坑清单（贴砖核对/家电尺寸/验收）',url:'https://neodrop.ai/zh-cn/post/XqPGlWsk-Vg',heat:'高',follow:'把经验做成节点清单或对照表：贴砖核对、家电尺寸、预算与验收。',remake:'做你的「装修节点清单」，分水电/泥瓦/软装几期，强收藏。'},
  {title:'生活化减脂 Day N 打卡（吃饱喝足/三餐记录）',url:'https://neodrop.ai/ko/post/tz5kugAxTui',heat:'高',follow:'记录可持续过程，写真实饮食记录（早餐/午餐/晚餐/饮水/运动），少做极端承诺。',remake:'做你的「减脂Day日记」，打工人快手餐/一人食/饮食记录都比「自律变瘦」易保存。'},
  {title:'AI 工作效率（会议纪要/思维导图/资料整理）',url:'https://neodrop.ai/ko/post/tz5kugAxTui',heat:'中',follow:'从一个具体工作任务切入（纪要/导图/整理），不只讲模型名。',remake:'做你的「AI提效流」，每期一个职场任务+工具实测。'},
  {title:'敏感肌/肤质自测（先别叠加产品）',url:'https://neodrop.ai/ko/post/tz5kugAxTui',heat:'中',follow:'先做问题识别（干敏/泛红/刺痛），再给温和的行动边界，不医疗化承诺。',remake:'做你的「肤质自测+成分避坑」，拆成泛红/刺痛/湿敷等具体场景。'},
  {title:'夏季穿搭（显瘦通勤/极简黑白/松弛感）',url:'https://neodrop.ai/ko/post/tz5kugAxTui',heat:'中',follow:'把身材、场景和气温写进标题，松弛感/极简黑白是稳定流量。',remake:'做你的「夏日通勤穿搭」，按身材/场景细分，提高搜索命中。'},
  {title:'手搓动物园宠物创意（反差萌·话题2亿浏览）',url:'https://www.sohu.com/a/1050167200_121967139',heat:'高',follow:'给毛孩子套上动物头套（脸挖空），制造视觉错位反差萌，门槛低趣味强。',remake:'把「反差萌+创意剧情」迁移到你的宠物或物品，参与#动物园里有什么。'},
  {title:'Softfit 柔系穿搭（低饱和/面料质感）',url:'https://www.toutiao.com/a7664431714093122102',heat:'中',follow:'强调天然亲肤面料、低饱和色系（棕/杏/白），用物理的「轻」回应心理的「松」。',remake:'做你的「柔系穿搭」，布局「性格/气质测试+穿搭思路」。'},
  {title:'本命穿搭/色彩测试（先有性格再有风格）',url:'https://www.toutiao.com/a7664431714093122102',heat:'中',follow:'聚焦「色彩测试/气质类型测试/穿得像自己」，先有性格再有风格。',remake:'做你的「本命色穿搭」测试向内容，强互动高收藏。'},
  {title:'美妆疗愈/身体护理（悦己→愈己）',url:'https://www.toutiao.com/a7664431714093122102',heat:'中',follow:'身体护理与男士护肤破局，情绪价值+成分，从「悦己」走向「愈己」。',remake:'做你的「愈己好物」，情绪价值叙事比单纯测评更易涨粉。'},
  {title:'知识图文/信息差（时政打卡/热点信息差）',url:'https://neodrop.ai/zh-cn/post/XqPGlWsk-Vg',heat:'中',follow:'四条消息一页讲清，适合知识图文和申论素材卡，信息差标题有吸引力。',remake:'做你领域的「每日信息差」，正文事实需先核验，建立可信人设。'}
];

function flatten(date){
  const idx = Math.floor(Date.parse(date)/86400000)%7;
  const rot=(a,n,o)=>{const r=[];for(let i=0;i<n;i++)r.push(a[((i+o)%a.length+a.length)%a.length]);return r;};
  return [
    ...rot(DOUYIN,6,idx).map(x=>({...x,platform:'抖音'})),
    ...rot(XHS,6,idx+2).map(x=>({...x,platform:'小红书'}))
  ];
}

async function liveFetch(date){
  // 1) 若配置了 HOT_API 则用用户自定义源
  const url=process.env.HOT_API;
  if(url){
    try{
      const j=await fetchJSON(url+(url.includes('?')?'&':'?')+'date='+date);
      let arr=Array.isArray(j)?j:(j.items||j.topics||null);
      if(arr&&arr.length) return arr.map(x=>({
        platform:x.platform||(/小红/.test(x.title||'')?'小红书':'抖音'),
        title:x.title, url:x.url||'', heat:x.heat||'中',
        follow:x.follow||x.way||'', remake:x.remake||x.tip||''
      }));
    }catch(e){ console.warn('[live fetch] HOT_API 失败，降级默认源：',e.message); }
  }
  // 2) 默认真实源：今日头条热榜（后端直连，无 CORS 问题）
  try{
    const j=await fetchJSON('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc','https://www.toutiao.com/');
    const arr=j&&j.data;
    if(Array.isArray(arr)&&arr.length){
      return arr.filter(x=>x.Title).map((x,i)=>({
        platform:'抖音',
        title:x.Title,
        url:x.Url||'',
        heat: i<10?'高':(i<25?'中':'低'),
        follow:'结合你的领域做延展解读/二创，比泛泛跟风更吸粉',
        remake:'用你行业的视角拆解这条热点，给出可落地的跟拍或图文思路'
      }));
    }
  }catch(e){ console.warn('[头条热榜] 失败，降级内置种子：',e.message); }
  return null;
}

/* ============ 理财趋势：板块资讯（/api/market-news） ============ */
/* 真实内置种子：来自 2026-07 公开报道（央行/工信部/能源局/新浪财经/上海证券报/央视/国际能源网 等）。
   设置环境变量 NEWS_API 指向你可靠的财经资讯 JSON 接口（返回同结构数组）即可获得实时数据。 */
const MARKET_NEWS=[
  {news_title:'LPR连续14个月按兵不动，下半年货币政策宽松空间打开',news_content:'7月20日央行公布LPR：1年期3.0%、5年期以上3.5%均不变。专家预计下半年或降息10个基点、降准可期，带动LPR下行。',source_name:'上海证券报·中国证券网',source_url:'https://finance.sina.com.cn/roll/2026-07-20/doc-iniimkkq4918785.shtml',publish_date:'2026-07-20',category_type:'macro',target_sectors:['金融'],authenticity:'media'},
  {news_title:'央行：加大逆周期和跨周期调节力度，巩固经济稳中向好',news_content:'国新办发布会介绍上半年货币政策执行。央行表示综合运用降准、逆回购、MLF、国债买卖等工具，保持流动性合理充裕，加力支持科技创新、中小微企业、促消费等重点领域。',source_name:'中国政府网',source_url:'https://www.gov.cn/zhengce/202607/content_7075657.htm',publish_date:'2026-07-15',category_type:'macro',target_sectors:['金融'],authenticity:'official'},
  {news_title:'科创板第五套标准扩围至AI大模型企业，半导体出口量价齐升',news_content:'7月22日上交所将科创板第五套上市标准扩围至AI大模型企业。工信部披露上半年制造业AI技术应用普及率超30%，集成电路、工业机器人产量两位数增长；韩国7月前20天半导体出口同比增180.6%。',source_name:'金融界',source_url:'https://fund.jrj.com.cn/2026/07/22133557871273.shtml',publish_date:'2026-07-22',category_type:'industry',target_sectors:['半导体','人工智能'],authenticity:'media'},
  {news_title:'"算电协同"写入十五五规划，光伏+储能迎长期利好',news_content:'2026年"算电协同"首次写入政府工作报告并纳入十五五规划纲要。国家数据局推进算电协同工程，要求枢纽节点新建算力设施绿电占比达80%以上，光伏企业加速进入AIDC赛道。',source_name:'国际能源网',source_url:'https://solar.in-en.com/html/solar-2461746.shtml',publish_date:'2026-07-18',category_type:'industry',target_sectors:['新能源'],authenticity:'media'},
  {news_title:'能源局印发十五五新型储能发展方案，设千亿引导基金',news_content:'上调2030储能装机目标，设立千亿引导基金，推行强制配储、储能出口退税，利好储能与电网设备。',source_name:'新浪财经',source_url:'http://www.sina.cn/news/detail/5319440884564735.html',publish_date:'2026-07-11',category_type:'industry',target_sectors:['新能源'],authenticity:'media'},
  {news_title:'十五五集成电路专项规划细则落地，大基金三期倾斜设备',news_content:'大基金三期重点倾斜半导体设备、先进封测，补贴扶持国产设备替代，利好半导体全产业链。',source_name:'新浪财经',source_url:'http://www.sina.cn/news/detail/5319440884564735.html',publish_date:'2026-07-11',category_type:'industry',target_sectors:['半导体'],authenticity:'media'},
  {news_title:'九部门出台零售业创新扶持20条，加码以旧换新',news_content:'加码家电、汽车以旧换新，支持商超数字化，拓宽消费企业信贷、REITs融资渠道，利好消费电子与整车消费。',source_name:'新浪财经',source_url:'http://www.sina.cn/news/detail/5319440884564735.html',publish_date:'2026-07-11',category_type:'industry',target_sectors:['消费'],authenticity:'media'},
  {news_title:'2026新版国家基药目录发布，16款国产创新药纳入',news_content:'新增109个品种，16款国产创新药纳入，9月实施，拓宽基层医院销售渠道，利好创新药、CXO、中药。',source_name:'新浪财经',source_url:'http://www.sina.cn/news/detail/5319440884564735.html',publish_date:'2026-07-11',category_type:'industry',target_sectors:['医药'],authenticity:'media'},
  {news_title:'商业航天海上回收试验成功，配套补贴落地',news_content:'长征十号乙一子级海上回收完成，各地航天产业园专项补贴落地，低轨卫星加速组网，利好卫星导航、航天零部件。',source_name:'新浪财经',source_url:'http://www.sina.cn/news/detail/5319440884564735.html',publish_date:'2026-07-11',category_type:'industry',target_sectors:['军工'],authenticity:'media'},
  {news_title:'工信部：综合整治"内卷式"竞争，发布光伏等强制国标',news_content:'工信部加强内卷式竞争综合整治，发布光伏、智能网联汽车等领域强制性国家标准，电池制造行业PPI连续4个月同比上涨，碳酸锂等价格趋稳。',source_name:'央视网',source_url:'https://ysxw.cctv.cn/article.html?item_id=9432480170384526683',publish_date:'2026-07-20',category_type:'industry',target_sectors:['新能源'],authenticity:'media'}
];
async function liveNews(date){
  // 1) 若配置了 NEWS_API 则用用户自定义源
  const url=process.env.NEWS_API;
  if(url){
    try{
      const j=await fetchJSON(url+(url.includes('?')?'&':'?')+'date='+date);
      let arr=Array.isArray(j)?j:(j.items||j.news||null);
      if(arr&&arr.length) return arr.map(x=>({
        news_title:x.news_title||x.title, news_content:x.news_content||x.content||'',
        source_name:x.source_name||x.source||'', source_url:x.source_url||x.url||'', publish_date:x.publish_date||x.date||date,
        category_type:x.category_type||'industry', target_sectors:x.target_sectors||[], authenticity:x.authenticity||'media'
      }));
    }catch(e){ console.warn('[market live fetch] NEWS_API 失败，降级默认源：',e.message); }
  }
  // 2) 默认真实源：新浪财经滚动（后端直连，无 CORS 问题）
  try{
    const j=await fetchJSON('https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2510&num=30&page=1','https://finance.sina.com.cn/');
    const items=j&&j.result&&j.result.data;
    if(Array.isArray(items)&&items.length){
      return items.filter(x=>x.title).map(x=>({
        news_title:x.title,
        news_content:x.intro||x.summary||'',
        source_name:x.media_name||'新浪财经',
        source_url:x.url||x.wapurl||'',
        publish_date: x.ctime? new Date(x.ctime*1000).toISOString().slice(0,10): date,
        category_type:classifyMarket(x.title, x.intro||''),
        target_sectors:[],
        authenticity:'media'
      }));
    }
  }catch(e){ console.warn('[新浪财经] 失败，降级内置种子：',e.message); }
  return null;
}

http.createServer(async (req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  if(req.method==='OPTIONS'){ res.statusCode=204; return res.end(); }
  if(req.url.startsWith('/api/topics')){
    const date=new URL(req.url,'http://localhost').searchParams.get('date')||new Date().toISOString().slice(0,10);
    let items=await liveFetch(date); let source='live';
    if(!items){ items=flatten(date); source='builtin'; }
    res.setHeader('Content-Type','application/json;charset=utf-8');
    return res.end(JSON.stringify({source,date,items}));
  }
  if(req.url.startsWith('/api/market-news')){
    const date=new URL(req.url,'http://localhost').searchParams.get('date')||new Date().toISOString().slice(0,10);
    let items=await liveNews(date); let source='live';
    if(!items){ items=MARKET_NEWS; source='builtin'; }
    res.setHeader('Content-Type','application/json;charset=utf-8');
    return res.end(JSON.stringify({source,date,items}));
  }
  if(req.url.startsWith('/api/ai')){
    if(req.method!=='POST'){ res.statusCode=405; res.setHeader('Content-Type','text/plain;charset=utf-8'); return res.end('Method Not Allowed'); }
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',async()=>{
      try{
        const p=JSON.parse(body||'{}');
        const apiBase=p.apiBase||process.env.ARK_API_BASE||'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
        const apiKey=p.apiKey||process.env.ARK_API_KEY||'';
        const model=p.model||p.apiModel||process.env.ARK_MODEL||'doubao-seed-1-6-250615';
        if(!apiKey){ res.statusCode=400; res.setHeader('Content-Type','application/json;charset=utf-8'); return res.end(JSON.stringify({error:'未提供 apiKey，且后端未配置 ARK_API_KEY 环境变量'})); }
        const r=await fetch(apiBase,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},body:JSON.stringify({model,messages:p.messages||[],temperature:p.temperature||0.7,stream:false})});
        const txt=await r.text();
        res.statusCode=r.status;
        res.setHeader('Content-Type','application/json;charset=utf-8');
        return res.end(txt);
      }catch(e){
        res.statusCode=500; res.setHeader('Content-Type','application/json;charset=utf-8');
        return res.end(JSON.stringify({error:String(e&&e.message||e)}));
      }
    });
    return;
  }
  res.setHeader('Content-Type','text/plain;charset=utf-8');
  res.end('服务运行中。GET /api/topics?date=YYYY-MM-DD | GET /api/market-news?date=YYYY-MM-DD | POST /api/ai');
}).listen(PORT,()=>{
  console.log('[server] 后端服务已启动: http://localhost:'+PORT);
  console.log('  GET  /api/topics      -> 抖音/小红书选题 (HOT_API 启用实时)');
  console.log('  GET  /api/market-news -> 理财趋势资讯 (NEWS_API 启用实时)');
  console.log('  POST /api/ai          -> AI 对话代理 (ARK_API_KEY)');
});
