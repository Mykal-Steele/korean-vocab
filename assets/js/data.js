/**
 * Vocabulary source data.
 *
 * Fields
 *   ko        Hangul spelling
 *   rom       Revised Romanization of the whole word
 *   syl       Per-syllable romanization (aligned 1:1 with the syllables of `ko`)
 *   say       Actual pronunciation when it differs from the spelling (sound-change rules)
 *   accept    Extra spellings accepted when typing the English meaning
 *   en        English gloss
 *   th        Thai gloss
 *   category  Grouping key, see CATEGORIES
 *   example   Short sentence using the word, with translation
 */
const CATEGORIES = [
  { id: 'nara', ko: '나라', en: 'Countries', th: 'ประเทศ' },
  { id: 'jigeop', ko: '직업', en: 'Occupations', th: 'อาชีพ' },
  { id: 'mulgeon', ko: '물건', en: 'Things', th: 'สิ่งของ' },
  { id: 'sutja', ko: '고유어 숫자', en: 'Native numbers', th: 'ตัวเลขเกาหลีแท้' },
  { id: 'eumnyo', ko: '음료', en: 'Drinks', th: 'เครื่องดื่ม' },
  { id: 'jangso', ko: '장소', en: 'Places', th: 'สถานที่' },
  { id: 'hanja', ko: '한자어 숫자', en: 'Sino-Korean numbers', th: 'ตัวเลขจีน-เกาหลี' }
];

const WORDS = [
  {
    ko: '독일', rom: 'dogil', syl: ['dok', 'il'], say: '도길',
    accept: ['germany', 'deutschland'],
    en: 'Germany', th: 'เยอรมนี', category: 'nara',
    example: { ko: '독일은 유럽에 있어요.', en: 'Germany is in Europe.' }
  },
  {
    ko: '러시아', rom: 'reosia', syl: ['reo', 'si', 'a'],
    accept: ['russia'],
    en: 'Russia', th: 'รัสเซีย', category: 'nara',
    example: { ko: '러시아는 아주 커요.', en: 'Russia is very big.' }
  },
  {
    ko: '미국', rom: 'miguk', syl: ['mi', 'guk'],
    accept: ['usa', 'us', 'united states', 'united states of america', 'america', 'american'],
    en: 'United States / USA', th: 'สหรัฐอเมริกา', category: 'nara',
    example: { ko: '저는 미국 사람이에요.', en: 'I am American.' }
  },
  {
    ko: '베트남', rom: 'beteunam', syl: ['be', 'teu', 'nam'],
    accept: ['vietnam', 'viet nam'],
    en: 'Vietnam', th: 'เวียดนาม', category: 'nara',
    example: { ko: '베트남 음식은 맛있어요.', en: 'Vietnamese food is delicious.' }
  },
  {
    ko: '일본', rom: 'ilbon', syl: ['il', 'bon'],
    accept: ['japan'],
    en: 'Japan', th: 'ญี่ปุ่น', category: 'nara',
    example: { ko: '일본에 가고 싶어요.', en: 'I want to go to Japan.' }
  },
  {
    ko: '중국', rom: 'jungguk', syl: ['jung', 'guk'],
    accept: ['china'],
    en: 'China', th: 'จีน', category: 'nara',
    example: { ko: '중국어를 배워요.', en: 'I study Chinese.' }
  },
  {
    ko: '태국', rom: 'taeguk', syl: ['tae', 'guk'],
    accept: ['thailand', 'thai'],
    en: 'Thailand', th: 'ประเทศไทย', category: 'nara',
    example: { ko: '태국은 아주 더워요.', en: 'Thailand is very hot.' }
  },
  {
    ko: '한국', rom: 'hanguk', syl: ['han', 'guk'],
    accept: ['korea', 'south korea', 'republic of korea'],
    en: 'Korea', th: 'เกาหลี / เกาหลีใต้', category: 'nara',
    example: { ko: '한국에서 공부해요.', en: 'I study in Korea.' }
  },
  {
    ko: '선생님', rom: 'seonsaengnim', syl: ['seon', 'saeng', 'nim'],
    accept: ['teacher'],
    en: 'Teacher', th: 'ครู', category: 'jigeop',
    example: { ko: '선생님, 안녕하세요?', en: 'Hello, teacher.' }
  },
  {
    ko: '요리사', rom: 'yorisa', syl: ['yo', 'ri', 'sa'],
    accept: ['cook', 'chef'],
    en: 'Cook / Chef', th: 'พ่อครัว / แม่ครัว', category: 'jigeop',
    example: { ko: '우리 아버지는 요리사예요.', en: 'My father is a cook.' }
  },
  {
    ko: '의사', rom: 'uisa', syl: ['ui', 'sa'],
    accept: ['doctor', 'physician'],
    en: 'Doctor', th: 'แพทย์ / หมอ', category: 'jigeop',
    example: { ko: '의사가 되고 싶어요.', en: 'I want to become a doctor.' }
  },
  {
    ko: '학생', rom: 'haksaeng', syl: ['hak', 'saeng'], say: '학쌩',
    accept: ['student', 'pupil'],
    en: 'Student', th: 'นักเรียน / นักศึกษา', category: 'jigeop',
    example: { ko: '저는 학생이에요.', en: 'I am a student.' }
  },
  {
    ko: '회사원', rom: 'hoesawon', syl: ['hoe', 'sa', 'won'],
    accept: ['office worker', 'company employee', 'office employee', 'employee', 'salaryman'],
    en: 'Office worker / Company employee', th: 'พนักงานบริษัท', category: 'jigeop',
    example: { ko: '형은 회사원이에요.', en: 'My older brother is an office worker.' }
  },
  {
    ko: '가방', rom: 'gabang', syl: ['ga', 'bang'],
    accept: ['bag', 'handbag', 'backpack'],
    en: 'Bag', th: 'กระเป๋า', category: 'mulgeon',
    example: { ko: '가방이 무거워요.', en: 'The bag is heavy.' }
  },
  {
    ko: '구두', rom: 'gudu', syl: ['gu', 'du'],
    accept: ['dress shoes', 'dress shoe', 'leather shoes', 'shoes'],
    en: 'Dress shoes', th: 'รองเท้าหนัง', category: 'mulgeon',
    example: { ko: '구두를 신어요.', en: 'I wear dress shoes.' }
  },
  {
    ko: '모자', rom: 'moja', syl: ['mo', 'ja'],
    accept: ['hat', 'cap'],
    en: 'Hat', th: 'หมวก', category: 'mulgeon',
    example: { ko: '모자를 써요.', en: 'I wear a hat.' }
  },
  {
    ko: '시계', rom: 'sigye', syl: ['si', 'gye'],
    accept: ['watch', 'clock', 'wristwatch'],
    en: 'Watch / Clock', th: 'นาฬิกา', category: 'mulgeon',
    example: { ko: '시계가 빨라요.', en: 'The clock is fast.' }
  },
  {
    ko: '안경', rom: 'angyeong', syl: ['an', 'gyeong'],
    accept: ['glasses', 'eyeglasses', 'spectacles'],
    en: 'Glasses', th: 'แว่นตา', category: 'mulgeon',
    example: { ko: '안경을 써요.', en: 'I wear glasses.' }
  },
  {
    ko: '볼펜', rom: 'bolpen', syl: ['bol', 'pen'],
    accept: ['ballpoint pen', 'ball point pen', 'ballpen', 'pen'],
    en: 'Ballpoint pen', th: 'ปากกาลูกลื่น', category: 'mulgeon',
    example: { ko: '볼펜으로 쓰세요.', en: 'Please write with a ballpoint pen.' }
  },
  {
    ko: '사전', rom: 'sajeon', syl: ['sa', 'jeon'],
    accept: ['dictionary'],
    en: 'Dictionary', th: 'พจนานุกรม', category: 'mulgeon',
    example: { ko: '사전에서 단어를 찾아요.', en: 'I look up words in the dictionary.' }
  },
  {
    ko: '연필', rom: 'yeonpil', syl: ['yeon', 'pil'],
    accept: ['pencil'],
    en: 'Pencil', th: 'ดินสอ', category: 'mulgeon',
    example: { ko: '연필이 짧아요.', en: 'The pencil is short.' }
  },
  {
    ko: '의자', rom: 'uija', syl: ['ui', 'ja'],
    accept: ['chair', 'seat'],
    en: 'Chair', th: 'เก้าอี้', category: 'mulgeon',
    example: { ko: '의자에 앉으세요.', en: 'Please sit on the chair.' }
  },
  {
    ko: '지우개', rom: 'jiugae', syl: ['ji', 'u', 'gae'],
    accept: ['eraser', 'rubber'],
    en: 'Eraser', th: 'ยางลบ', category: 'mulgeon',
    example: { ko: '지우개를 빌려주세요.', en: 'Please lend me an eraser.' }
  },
  {
    ko: '책', rom: 'chaek', syl: ['chaek'],
    accept: ['book'],
    en: 'Book', th: 'หนังสือ', category: 'mulgeon',
    example: { ko: '책을 읽어요.', en: 'I read a book.' }
  },
  {
    ko: '책상', rom: 'chaeksang', syl: ['chaek', 'sang'], say: '책쌍',
    accept: ['desk', 'writing desk'],
    en: 'Desk', th: 'โต๊ะเรียน / โต๊ะทำงาน', category: 'mulgeon',
    example: { ko: '책상 위에 책이 있어요.', en: 'There is a book on the desk.' }
  },
  {
    ko: '필통', rom: 'piltong', syl: ['pil', 'tong'],
    accept: ['pencil case', 'pencilcase', 'pen case'],
    en: 'Pencil case', th: 'กล่องดินสอ', category: 'mulgeon',
    example: { ko: '필통에 연필이 있어요.', en: 'There are pencils in the pencil case.' }
  },
  {
    ko: '복사기', rom: 'boksagi', syl: ['bok', 'sa', 'gi'], say: '복싸기',
    accept: ['copier', 'photocopier', 'copy machine', 'copying machine'],
    en: 'Copier / Photocopier', th: 'เครื่องถ่ายเอกสาร', category: 'mulgeon',
    example: { ko: '복사기가 고장 났어요.', en: 'The copier is broken.' }
  },
  {
    ko: '카메라', rom: 'kamera', syl: ['ka', 'me', 'ra'],
    accept: ['camera'],
    en: 'Camera', th: 'กล้อง', category: 'mulgeon',
    example: { ko: '카메라로 사진을 찍어요.', en: 'I take photos with a camera.' }
  },
  {
    ko: '컴퓨터', rom: 'keompyuteo', syl: ['keom', 'pyu', 'teo'],
    accept: ['computer', 'pc'],
    en: 'Computer', th: 'คอมพิวเตอร์', category: 'mulgeon',
    example: { ko: '컴퓨터를 켜세요.', en: 'Please turn on the computer.' }
  },
  {
    ko: '핸드폰', rom: 'haendeupon', syl: ['haen', 'deu', 'pon'],
    accept: ['mobile phone', 'cell phone', 'cellphone', 'phone', 'handphone', 'mobile', 'smartphone'],
    en: 'Mobile phone', th: 'โทรศัพท์มือถือ', category: 'mulgeon',
    example: { ko: '핸드폰으로 전화해요.', en: 'I call on my mobile phone.' }
  },
  {
    ko: '하나', rom: 'hana', syl: ['ha', 'na'],
    accept: ['one', '1'],
    en: 'One', th: 'หนึ่ง', category: 'sutja',
    example: { ko: '하나만 주세요.', en: 'Just one, please.' }
  },
  {
    ko: '둘', rom: 'dul', syl: ['dul'],
    accept: ['two', '2'],
    en: 'Two', th: 'สอง', category: 'sutja',
    example: { ko: '둘이 같이 가요.', en: 'The two of us go together.' }
  },
  {
    ko: '셋', rom: 'set', syl: ['set'],
    accept: ['three', '3'],
    en: 'Three', th: 'สาม', category: 'sutja',
    example: { ko: '하나, 둘, 셋!', en: 'One, two, three!' }
  },
  {
    ko: '넷', rom: 'net', syl: ['net'],
    accept: ['four', '4'],
    en: 'Four', th: 'สี่', category: 'sutja',
    example: { ko: '우리는 넷이에요.', en: 'There are four of us.' }
  },
  {
    ko: '다섯', rom: 'daseot', syl: ['da', 'seot'],
    accept: ['five', '5'],
    en: 'Five', th: 'ห้า', category: 'sutja',
    example: { ko: '다섯 시에 만나요.', en: 'Let us meet at five o\'clock.' }
  },
  {
    ko: '여섯', rom: 'yeoseot', syl: ['yeo', 'seot'],
    accept: ['six', '6'],
    en: 'Six', th: 'หก', category: 'sutja',
    example: { ko: '사과가 여섯 개 있어요.', en: 'There are six apples.' }
  },
  {
    ko: '일곱', rom: 'ilgop', syl: ['il', 'gop'],
    accept: ['seven', '7'],
    en: 'Seven', th: 'เจ็ด', category: 'sutja',
    example: { ko: '일곱 시에 일어나요.', en: 'I get up at seven.' }
  },
  {
    ko: '여덟', rom: 'yeodeol', syl: ['yeo', 'deol'], say: '여덜',
    accept: ['eight', '8'],
    en: 'Eight', th: 'แปด', category: 'sutja',
    example: { ko: '여덟 명이 왔어요.', en: 'Eight people came.' }
  },
  {
    ko: '아홉', rom: 'ahop', syl: ['a', 'hop'],
    accept: ['nine', '9'],
    en: 'Nine', th: 'เก้า', category: 'sutja',
    example: { ko: '아홉 시에 자요.', en: 'I go to bed at nine.' }
  },
  {
    ko: '열', rom: 'yeol', syl: ['yeol'],
    accept: ['ten', '10'],
    en: 'Ten', th: 'สิบ', category: 'sutja',
    example: { ko: '열 명이 있어요.', en: 'There are ten people.' }
  },
  {
    ko: '녹차', rom: 'nokcha', syl: ['nok', 'cha'],
    accept: ['green tea', 'greentea'],
    en: 'Green tea', th: 'ชาเขียว', category: 'eumnyo',
    example: { ko: '녹차를 마셔요.', en: 'I drink green tea.' }
  },
  {
    ko: '레몬차', rom: 'remoncha', syl: ['re', 'mon', 'cha'],
    accept: ['lemon tea', 'lemontea'],
    en: 'Lemon tea', th: 'ชามะนาว', category: 'eumnyo',
    example: { ko: '레몬차가 따뜻해요.', en: 'The lemon tea is warm.' }
  },
  {
    ko: '맥주', rom: 'maekju', syl: ['maek', 'ju'], say: '맥쭈',
    accept: ['beer'],
    en: 'Beer', th: 'เบียร์', category: 'eumnyo',
    example: { ko: '맥주 한 잔 주세요.', en: 'One glass of beer, please.' }
  },
  {
    ko: '물', rom: 'mul', syl: ['mul'],
    accept: ['water'],
    en: 'Water', th: 'น้ำ', category: 'eumnyo',
    example: { ko: '물 좀 주세요.', en: 'Some water, please.' }
  },
  {
    ko: '사이다', rom: 'saida', syl: ['sa', 'i', 'da'],
    accept: ['soda', 'sprite', 'cider', 'lemon lime soda', 'lemon-lime soda', 'fizzy drink'],
    en: 'Lemon-lime soda', th: 'น้ำอัดลม', category: 'eumnyo',
    example: { ko: '사이다는 시원해요.', en: 'The soda is refreshing.' }
  },
  {
    ko: '오렌지주스', rom: 'orenjijuseu', syl: ['o', 'ren', 'ji', 'ju', 'seu'],
    accept: ['orange juice', 'orangejuice'],
    en: 'Orange juice', th: 'น้ำส้ม', category: 'eumnyo',
    example: { ko: '오렌지주스를 좋아해요.', en: 'I like orange juice.' }
  },
  {
    ko: '커피', rom: 'keopi', syl: ['keo', 'pi'],
    accept: ['coffee'],
    en: 'Coffee', th: 'กาแฟ', category: 'eumnyo',
    example: { ko: '아침에 커피를 마셔요.', en: 'I drink coffee in the morning.' }
  },
  {
    ko: '콜라', rom: 'kolla', syl: ['kol', 'la'],
    accept: ['cola', 'coke'],
    en: 'Cola', th: 'โคล่า', category: 'eumnyo',
    example: { ko: '콜라가 차가워요.', en: 'The cola is cold.' }
  },
  {
    ko: '교실', rom: 'gyosil', syl: ['gyo', 'sil'],
    accept: ['classroom'],
    en: 'Classroom', th: 'ห้องเรียน', category: 'jangso',
    example: { ko: '교실이 아주 커요.', en: 'The classroom is very big.' }
  },
  {
    ko: '극장', rom: 'geukjang', syl: ['geuk', 'jang'], say: '극짱',
    accept: ['theater', 'theatre', 'cinema', 'movie theater'],
    en: 'Theater', th: 'โรงละคร', category: 'jangso',
    example: { ko: '극장에서 영화를 봐요.', en: 'I watch a film at the theater.' }
  },
  {
    ko: '대사관', rom: 'daesagwan', syl: ['dae', 'sa', 'gwan'],
    accept: ['embassy'],
    en: 'Embassy', th: 'สถานทูต', category: 'jangso',
    example: { ko: '대사관에 가야 해요.', en: 'I have to go to the embassy.' }
  },
  {
    ko: '도서관', rom: 'doseogwan', syl: ['do', 'seo', 'gwan'],
    accept: ['library'],
    en: 'Library', th: 'ห้องสมุด', category: 'jangso',
    example: { ko: '도서관에서 공부해요.', en: 'I study at the library.' }
  },
  {
    ko: '문구점', rom: 'mungujeom', syl: ['mun', 'gu', 'jeom'],
    accept: ['stationery store', 'stationery shop', 'stationery', 'stationers'],
    en: 'Stationery store', th: 'ร้านเครื่องเขียน', category: 'jangso',
    example: { ko: '문구점에서 연필을 사요.', en: 'I buy a pencil at the stationery store.' }
  },
  {
    ko: '병원', rom: 'byeongwon', syl: ['byeong', 'won'],
    accept: ['hospital', 'clinic'],
    en: 'Hospital', th: 'โรงพยาบาล', category: 'jangso',
    example: { ko: '병원에 가요.', en: 'I go to the hospital.' }
  },
  {
    ko: '서점', rom: 'seojeom', syl: ['seo', 'jeom'],
    accept: ['bookstore', 'bookshop', 'book store', 'book shop'],
    en: 'Bookstore', th: 'ร้านหนังสือ', category: 'jangso',
    example: { ko: '서점에서 책을 사요.', en: 'I buy a book at the bookstore.' }
  },
  {
    ko: '수영장', rom: 'suyeongjang', syl: ['su', 'yeong', 'jang'],
    accept: ['swimming pool', 'pool'],
    en: 'Swimming pool', th: 'สระว่ายน้ำ', category: 'jangso',
    example: { ko: '수영장에서 수영해요.', en: 'I swim at the swimming pool.' }
  },
  {
    ko: '식당', rom: 'sikdang', syl: ['sik', 'dang'], say: '식땅',
    accept: ['restaurant', 'diner', 'eatery'],
    en: 'Restaurant', th: 'ร้านอาหาร', category: 'jangso',
    example: { ko: '식당에서 밥을 먹어요.', en: 'I eat at the restaurant.' }
  },
  {
    ko: '은행', rom: 'eunhaeng', syl: ['eun', 'haeng'],
    accept: ['bank'],
    en: 'Bank', th: 'ธนาคาร', category: 'jangso',
    example: { ko: '은행에서 돈을 바꿔요.', en: 'I change money at the bank.' }
  },
  {
    ko: '학교', rom: 'hakgyo', syl: ['hak', 'gyo'], say: '학꾜',
    accept: ['school'],
    en: 'School', th: 'โรงเรียน', category: 'jangso',
    example: { ko: '학교에 가요.', en: 'I go to school.' }
  },
  {
    ko: '화장실', rom: 'hwajangsil', syl: ['hwa', 'jang', 'sil'],
    accept: ['restroom', 'bathroom', 'toilet', 'washroom'],
    en: 'Restroom / Bathroom', th: 'ห้องน้ำ', category: 'jangso',
    example: { ko: '화장실이 어디예요?', en: 'Where is the restroom?' }
  },
  {
    ko: '회사', rom: 'hoesa', syl: ['hoe', 'sa'],
    accept: ['company', 'office', 'firm'],
    en: 'Company / Office', th: 'บริษัท', category: 'jangso',
    example: { ko: '회사에서 일해요.', en: 'I work at the company.' }
  },
  {
    ko: '영', rom: 'yeong', syl: ['yeong'],
    accept: ['zero', '0'],
    en: 'Zero', th: 'ศูนย์', category: 'hanja',
    example: { ko: '오늘은 영 도예요.', en: 'Today it is zero degrees.' }
  },
  {
    ko: '공', rom: 'gong', syl: ['gong'],
    accept: ['zero', '0', 'oh'],
    en: 'Zero in phone numbers', th: 'ศูนย์', category: 'hanja',
    example: { ko: '전화번호에 공이 많아요.', en: 'There are a lot of zeros in the phone number.' }
  },
  {
    ko: '일', rom: 'il', syl: ['il'],
    accept: ['one', '1'],
    en: 'One (Sino-Korean)', th: 'หนึ่ง', category: 'hanja',
    example: { ko: '일월에 만나요.', en: 'Let us meet in January.' }
  },
  {
    ko: '이', rom: 'i', syl: ['i'],
    accept: ['two', '2'],
    en: 'Two (Sino-Korean)', th: 'สอง', category: 'hanja',
    example: { ko: '이 층에 있어요.', en: 'It is on the second floor.' }
  },
  {
    ko: '삼', rom: 'sam', syl: ['sam'],
    accept: ['three', '3'],
    en: 'Three (Sino-Korean)', th: 'สาม', category: 'hanja',
    example: { ko: '삼 번 버스를 타요.', en: 'I take the number three bus.' }
  },
  {
    ko: '사', rom: 'sa', syl: ['sa'],
    accept: ['four', '4'],
    en: 'Four (Sino-Korean)', th: 'สี่', category: 'hanja',
    example: { ko: '사 학년이에요.', en: 'I am in the fourth year.' }
  },
  {
    ko: '오', rom: 'o', syl: ['o'],
    accept: ['five', '5'],
    en: 'Five (Sino-Korean)', th: 'ห้า', category: 'hanja',
    example: { ko: '오 분만 기다리세요.', en: 'Please wait just five minutes.' }
  },
  {
    ko: '육', rom: 'yuk', syl: ['yuk'],
    accept: ['six', '6'],
    en: 'Six (Sino-Korean)', th: 'หก', category: 'hanja',
    example: { ko: '육 개월 걸려요.', en: 'It takes six months.' }
  },
  {
    ko: '칠', rom: 'chil', syl: ['chil'],
    accept: ['seven', '7'],
    en: 'Seven (Sino-Korean)', th: 'เจ็ด', category: 'hanja',
    example: { ko: '칠 번 방이에요.', en: 'It is room number seven.' }
  },
  {
    ko: '팔', rom: 'pal', syl: ['pal'],
    accept: ['eight', '8'],
    en: 'Eight (Sino-Korean)', th: 'แปด', category: 'hanja',
    example: { ko: '팔 시간 일해요.', en: 'I work eight hours.' }
  },
  {
    ko: '구', rom: 'gu', syl: ['gu'],
    accept: ['nine', '9'],
    en: 'Nine (Sino-Korean)', th: 'เก้า', category: 'hanja',
    example: { ko: '구 층에 살아요.', en: 'I live on the ninth floor.' }
  },
  {
    ko: '십', rom: 'sip', syl: ['sip'],
    accept: ['ten', '10'],
    en: 'Ten (Sino-Korean)', th: 'สิบ', category: 'hanja',
    example: { ko: '십 분 후에 만나요.', en: 'Let us meet in ten minutes.' }
  },
  {
    ko: '백', rom: 'baek', syl: ['baek'],
    accept: ['one hundred', 'hundred', '100', 'a hundred'],
    en: 'One hundred', th: 'หนึ่งร้อย', category: 'hanja',
    example: { ko: '백 명이 왔어요.', en: 'A hundred people came.' }
  },
  {
    ko: '천', rom: 'cheon', syl: ['cheon'],
    accept: ['one thousand', 'thousand', '1000', '1,000', 'a thousand'],
    en: 'One thousand', th: 'หนึ่งพัน', category: 'hanja',
    example: { ko: '천 원이에요.', en: 'It is one thousand won.' }
  },
  {
    ko: '만', rom: 'man', syl: ['man'],
    accept: ['ten thousand', '10000', '10,000'],
    en: 'Ten thousand', th: 'หนึ่งหมื่น', category: 'hanja',
    example: { ko: '만 원을 냈어요.', en: 'I paid ten thousand won.' }
  }
];
