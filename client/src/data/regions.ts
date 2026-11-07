export interface Region {
  code: string;
  name: string;
  children?: Region[];
}

/**
 * 中国主要省份 + 每省 3-5 个主要城市（简化版，两级选择）
 * code 为城市 adcode 前 4 位或 6 位，作为 weatherAdcode 使用
 */
export const PROVINCES: Region[] = [
  {
    code: '110000',
    name: '北京市',
    children: [
      { code: '110100', name: '北京市' },
    ],
  },
  {
    code: '120000',
    name: '天津市',
    children: [
      { code: '120100', name: '天津市' },
    ],
  },
  {
    code: '130000',
    name: '河北省',
    children: [
      { code: '130100', name: '石家庄市' },
      { code: '130200', name: '唐山市' },
      { code: '130300', name: '秦皇岛市' },
      { code: '130600', name: '保定市' },
      { code: '131000', name: '廊坊市' },
    ],
  },
  {
    code: '140000',
    name: '山西省',
    children: [
      { code: '140100', name: '太原市' },
      { code: '140200', name: '大同市' },
      { code: '140400', name: '长治市' },
      { code: '140700', name: '晋中市' },
    ],
  },
  {
    code: '150000',
    name: '内蒙古自治区',
    children: [
      { code: '150100', name: '呼和浩特市' },
      { code: '150200', name: '包头市' },
      { code: '150400', name: '赤峰市' },
      { code: '150600', name: '鄂尔多斯市' },
    ],
  },
  {
    code: '210000',
    name: '辽宁省',
    children: [
      { code: '210100', name: '沈阳市' },
      { code: '210200', name: '大连市' },
      { code: '210300', name: '鞍山市' },
      { code: '210600', name: '丹东市' },
    ],
  },
  {
    code: '220000',
    name: '吉林省',
    children: [
      { code: '220100', name: '长春市' },
      { code: '220200', name: '吉林市' },
      { code: '220300', name: '四平市' },
      { code: '220400', name: '辽源市' },
    ],
  },
  {
    code: '230000',
    name: '黑龙江省',
    children: [
      { code: '230100', name: '哈尔滨市' },
      { code: '230200', name: '齐齐哈尔市' },
      { code: '230300', name: '鸡西市' },
      { code: '230600', name: '大庆市' },
    ],
  },
  {
    code: '310000',
    name: '上海市',
    children: [
      { code: '310100', name: '上海市' },
    ],
  },
  {
    code: '320000',
    name: '江苏省',
    children: [
      { code: '320100', name: '南京市' },
      { code: '320200', name: '无锡市' },
      { code: '320500', name: '苏州市' },
      { code: '320600', name: '南通市' },
      { code: '321000', name: '扬州市' },
    ],
  },
  {
    code: '330000',
    name: '浙江省',
    children: [
      { code: '330100', name: '杭州市' },
      { code: '330200', name: '宁波市' },
      { code: '330300', name: '温州市' },
      { code: '330600', name: '绍兴市' },
      { code: '330700', name: '金华市' },
    ],
  },
  {
    code: '340000',
    name: '安徽省',
    children: [
      { code: '340100', name: '合肥市' },
      { code: '340200', name: '芜湖市' },
      { code: '340300', name: '蚌埠市' },
      { code: '340800', name: '安庆市' },
    ],
  },
  {
    code: '350000',
    name: '福建省',
    children: [
      { code: '350100', name: '福州市' },
      { code: '350200', name: '厦门市' },
      { code: '350300', name: '莆田市' },
      { code: '350500', name: '泉州市' },
    ],
  },
  {
    code: '360000',
    name: '江西省',
    children: [
      { code: '360100', name: '南昌市' },
      { code: '360200', name: '景德镇市' },
      { code: '360400', name: '九江市' },
      { code: '360700', name: '赣州市' },
    ],
  },
  {
    code: '370000',
    name: '山东省',
    children: [
      { code: '370100', name: '济南市' },
      { code: '370200', name: '青岛市' },
      { code: '370300', name: '淄博市' },
      { code: '370600', name: '烟台市' },
      { code: '370800', name: '济宁市' },
    ],
  },
  {
    code: '410000',
    name: '河南省',
    children: [
      { code: '410100', name: '郑州市' },
      { code: '410200', name: '开封市' },
      { code: '410300', name: '洛阳市' },
      { code: '410700', name: '新乡市' },
    ],
  },
  {
    code: '420000',
    name: '湖北省',
    children: [
      { code: '420100', name: '武汉市' },
      { code: '420200', name: '黄石市' },
      { code: '420300', name: '十堰市' },
      { code: '420500', name: '宜昌市' },
      { code: '420600', name: '襄阳市' },
    ],
  },
  {
    code: '430000',
    name: '湖南省',
    children: [
      { code: '430100', name: '长沙市' },
      { code: '430200', name: '株洲市' },
      { code: '430300', name: '湘潭市' },
      { code: '430400', name: '衡阳市' },
    ],
  },
  {
    code: '440000',
    name: '广东省',
    children: [
      { code: '440100', name: '广州市' },
      { code: '440300', name: '深圳市' },
      { code: '440400', name: '珠海市' },
      { code: '440600', name: '佛山市' },
      { code: '441900', name: '东莞市' },
    ],
  },
  {
    code: '450000',
    name: '广西壮族自治区',
    children: [
      { code: '450100', name: '南宁市' },
      { code: '450200', name: '柳州市' },
      { code: '450300', name: '桂林市' },
      { code: '450500', name: '北海市' },
    ],
  },
  {
    code: '460000',
    name: '海南省',
    children: [
      { code: '460100', name: '海口市' },
      { code: '460200', name: '三亚市' },
      { code: '460300', name: '三沙市' },
      { code: '469000', name: '儋州市' },
    ],
  },
  {
    code: '500000',
    name: '重庆市',
    children: [
      { code: '500100', name: '重庆市' },
    ],
  },
  {
    code: '510000',
    name: '四川省',
    children: [
      { code: '510100', name: '成都市' },
      { code: '510300', name: '自贡市' },
      { code: '510400', name: '攀枝花市' },
      { code: '510500', name: '泸州市' },
      { code: '510700', name: '绵阳市' },
    ],
  },
  {
    code: '520000',
    name: '贵州省',
    children: [
      { code: '520100', name: '贵阳市' },
      { code: '520200', name: '六盘水市' },
      { code: '520300', name: '遵义市' },
      { code: '520400', name: '安顺市' },
    ],
  },
  {
    code: '530000',
    name: '云南省',
    children: [
      { code: '530100', name: '昆明市' },
      { code: '530300', name: '曲靖市' },
      { code: '530400', name: '玉溪市' },
      { code: '532800', name: '西双版纳州' },
    ],
  },
  {
    code: '540000',
    name: '西藏自治区',
    children: [
      { code: '540100', name: '拉萨市' },
      { code: '540200', name: '日喀则市' },
      { code: '540300', name: '昌都市' },
    ],
  },
  {
    code: '610000',
    name: '陕西省',
    children: [
      { code: '610100', name: '西安市' },
      { code: '610200', name: '铜川市' },
      { code: '610300', name: '宝鸡市' },
      { code: '610400', name: '咸阳市' },
    ],
  },
  {
    code: '620000',
    name: '甘肃省',
    children: [
      { code: '620100', name: '兰州市' },
      { code: '620200', name: '嘉峪关市' },
      { code: '620300', name: '金昌市' },
      { code: '620400', name: '白银市' },
    ],
  },
  {
    code: '630000',
    name: '青海省',
    children: [
      { code: '630100', name: '西宁市' },
      { code: '630200', name: '海东市' },
      { code: '632800', name: '海西州' },
    ],
  },
  {
    code: '640000',
    name: '宁夏回族自治区',
    children: [
      { code: '640100', name: '银川市' },
      { code: '640200', name: '石嘴山市' },
      { code: '640300', name: '吴忠市' },
    ],
  },
  {
    code: '650000',
    name: '新疆维吾尔自治区',
    children: [
      { code: '650100', name: '乌鲁木齐市' },
      { code: '650200', name: '克拉玛依市' },
      { code: '650400', name: '吐鲁番市' },
      { code: '650500', name: '哈密市' },
    ],
  },
  {
    code: '710000',
    name: '台湾省',
    children: [
      { code: '710100', name: '台北市' },
      { code: '710200', name: '高雄市' },
      { code: '710300', name: '台中市' },
    ],
  },
  {
    code: '810000',
    name: '香港特别行政区',
    children: [
      { code: '810100', name: '香港' },
    ],
  },
  {
    code: '820000',
    name: '澳门特别行政区',
    children: [
      { code: '820100', name: '澳门' },
    ],
  },
];

export const PROVIDER_LABELS: Record<string, string> = {
  wttr: '内置免费源 (wttr.in)',
  qweather: '和风天气 QWeather',
  amap: '高德开放平台',
  seniverse: '心知天气 Seniverse',
  custom: '自定义 API',
};

export function getAqiColor(level?: string): string {
  switch (level) {
    case '优':
      return 'text-green-400';
    case '良':
      return 'text-yellow-400';
    case '轻度污染':
      return 'text-orange-400';
    case '中度污染':
      return 'text-red-400';
    case '重度污染':
      return 'text-purple-400';
    case '严重污染':
      return 'text-rose-500';
    default:
      return 'text-muted-foreground';
  }
}
